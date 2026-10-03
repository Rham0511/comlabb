import mysql from 'mysql2/promise';
import { sequelize } from '../models/db.js';

// Get database config from environment
const {
  DB_HOST = 'localhost',
  DB_USER = 'comlab',
  DB_PASSWORD = 'comlab123',
  DB_NAME = 'comlab',
  DB_PORT = '3306'
} = process.env;

// Database pool
const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: Number(DB_PORT),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/**
 * Recalculate and update PC Set status based on current component statuses.
 * Called whenever a component is added, removed, or changes status.
 * Rules:
 *   Any Missing component       → incomplete
 *   Any Under Maintenance       → maintenance
 *   Any Unserviceable           → incomplete
 *   All Serviceable + CPU+Monitor → active
 *   Otherwise                   → incomplete
 */
async function recalculateSetStatusInternal(setId) {
  if (!setId) return;
  try {
    const [components] = await pool.query(
      'SELECT category, status FROM equipment WHERE setId = ?',
      [setId]
    );

    if (!components.length) {
      await pool.query("UPDATE equipment_sets SET status = 'incomplete', updatedAt = NOW() WHERE setId = ?", [setId]);
      return;
    }

    const statuses = components.map(c => String(c.status || '').toLowerCase());
    const categories = components.map(c => String(c.category || '').toLowerCase());

    let newStatus = 'active';
    if (statuses.some(s => s === 'missing')) {
      newStatus = 'incomplete';
    } else if (statuses.some(s => s === 'under maintenance')) {
      newStatus = 'maintenance';
    } else if (statuses.some(s => s === 'unserviceable')) {
      newStatus = 'incomplete';
    } else {
      const hasCpu = categories.some(c => c === 'cpu' || c === 'computer' || c === 'system unit');
      const hasMonitor = categories.some(c => c === 'monitor');
      if (!hasCpu || !hasMonitor) newStatus = 'incomplete';
    }

    await pool.query("UPDATE equipment_sets SET status = ?, updatedAt = NOW() WHERE setId = ?", [newStatus, setId]);
  } catch (err) {
    console.warn(`[set] recalculateSetStatusInternal failed for ${setId}:`, err.message);
  }
}

// Get all PC sets with component counts
export async function getAllPCSets(req, res) {
  try {
    const [sets] = await pool.query(`
      SELECT 
        es.*,
        COUNT(e.id) as componentCount,
        SUM(CASE WHEN e.status = 'Serviceable' THEN 1 ELSE 0 END) as serviceableCount,
        SUM(CASE WHEN e.status = 'Missing' THEN 1 ELSE 0 END) as missingCount,
        SUM(CASE WHEN e.status = 'Unserviceable' THEN 1 ELSE 0 END) as unserviceableCount,
        SUM(CASE WHEN e.status = 'Under Maintenance' THEN 1 ELSE 0 END) as underMaintenanceCount,
        GROUP_CONCAT(
          CONCAT(e.category, ' - ', e.name, ' [', e.status, ']') 
          ORDER BY e.category, e.name 
          SEPARATOR ', '
        ) as components
      FROM equipment_sets es
      LEFT JOIN equipment e ON BINARY e.setId = BINARY es.setId
      GROUP BY es.id
      ORDER BY es.setId
    `);

    const result = sets.map(s => ({
      ...s,
      completenessPercent: s.componentCount > 0
        ? Math.round((Number(s.serviceableCount || 0) / Number(s.componentCount)) * 100)
        : 0
    }));

    res.json({ success: true, sets: result });
  } catch (error) {
    console.error('Error fetching PC sets:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch PC sets', error: error.message });
  }
}

// Get single PC set with components
export async function getPCSetDetails(req, res) {
  try {
    const { setId } = req.params;

    // Get set details
    const [sets] = await pool.query(
      'SELECT * FROM equipment_sets WHERE setId = ?',
      [setId]
    );

    if (sets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'PC set not found'
      });
    }

    // Get components — include all statuses so Missing equipment still shows in its set
    const [components] = await pool.query(`
      SELECT 
        id,
        equipmentId,
        name,
        category,
        serialNumber,
        manufacturer,
        model,
        status,
        \`condition\`,
        location,
        missingReportedAt,
        missingReason,
        dateAdded
      FROM equipment
      WHERE setId = ?
      ORDER BY 
        FIELD(category, 'CPU', 'Monitor', 'Keyboard', 'Mouse', 'AVR', 'Other'),
        name
    `, [setId]);

    // Calculate completeness percentage
    const totalComponents = components.length;
    const serviceableComponents = components.filter(c =>
      String(c.status || '').toLowerCase() === 'serviceable'
    ).length;
    const missingComponents = components.filter(c =>
      String(c.status || '').toLowerCase() === 'missing'
    ).length;
    const completenessPercent = totalComponents > 0
      ? Math.round((serviceableComponents / totalComponents) * 100)
      : 0;

    res.json({
      success: true,
      set: sets[0],
      components,
      summary: {
        total: totalComponents,
        serviceable: serviceableComponents,
        missing: missingComponents,
        unserviceable: components.filter(c => String(c.status || '').toLowerCase() === 'unserviceable').length,
        underMaintenance: components.filter(c => String(c.status || '').toLowerCase() === 'under maintenance').length,
        completenessPercent
      }
    });
  } catch (error) {
    console.error('Error fetching PC set details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch PC set details',
      error: error.message
    });
  }
}

// Create new PC set
export async function createPCSet(req, res) {
  try {
    const { setId, setName, description, campusId, laboratoryId, location } = req.body;
    const userId = req.session?.userId;

    // Validate required fields
    if (!setId || !setName) {
      return res.status(400).json({
        success: false,
        message: 'Set ID and Set Name are required'
      });
    }

    // Check if setId already exists
    const [existing] = await pool.query(
      'SELECT id FROM equipment_sets WHERE setId = ?',
      [setId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Set ID already exists'
      });
    }

    // Insert new set
    await pool.query(`
      INSERT INTO equipment_sets (setId, setName, description, campusId, laboratoryId, location, status, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, 'incomplete', ?)
    `, [setId, setName, description, campusId, laboratoryId, location, userId]);

    res.json({
      success: true,
      message: 'PC set created successfully',
      setId
    });
  } catch (error) {
    console.error('Error creating PC set:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create PC set',
      error: error.message
    });
  }
}

// Update PC set
export async function updatePCSet(req, res) {
  try {
    const { setId } = req.params;
    const { setName, description, campusId, laboratoryId, location, status } = req.body;

    // Validate
    if (!setName) {
      return res.status(400).json({
        success: false,
        message: 'Set Name is required'
      });
    }

    // Check if exists
    const [existing] = await pool.query(
      'SELECT id FROM equipment_sets WHERE setId = ?',
      [setId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'PC set not found'
      });
    }

    // Update
    await pool.query(`
      UPDATE equipment_sets 
      SET setName = ?, 
          description = ?, 
          campusId = ?, 
          laboratoryId = ?, 
          location = ?,
          status = ?,
          updatedAt = CURRENT_TIMESTAMP
      WHERE setId = ?
    `, [setName, description, campusId, laboratoryId, location, status, setId]);

    res.json({
      success: true,
      message: 'PC set updated successfully'
    });
  } catch (error) {
    console.error('Error updating PC set:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update PC set',
      error: error.message
    });
  }
}

// Delete PC set
export async function deletePCSet(req, res) {
  try {
    const { setId } = req.params;

    // Check if set has components
    const [components] = await pool.query(
      'SELECT COUNT(*) as count FROM equipment WHERE setId = ?',
      [setId]
    );

    if (components[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete PC set. It has ${components[0].count} component(s). Remove all components first.`
      });
    }

    // Delete set
    const [result] = await pool.query(
      'DELETE FROM equipment_sets WHERE setId = ?',
      [setId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'PC set not found'
      });
    }

    res.json({
      success: true,
      message: 'PC set deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting PC set:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete PC set',
      error: error.message
    });
  }
}

// Get available equipment (not in any set)
export async function getAvailableEquipment(req, res) {
  try {
    const [equipment] = await pool.query(`
      SELECT 
        id,
        equipmentId,
        name,
        category,
        serialNumber,
        manufacturer,
        model,
        status,
        campus,
        laboratoryRoom
      FROM equipment
      WHERE setId IS NULL
        AND status = 'Serviceable'
      ORDER BY category, name
    `);

    res.json({
      success: true,
      equipment
    });
  } catch (error) {
    console.error('Error fetching available equipment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available equipment',
      error: error.message
    });
  }
}

// Add equipment to set
export async function addComponentToSet(req, res) {
  try {
    const { setId } = req.params;
    const { equipmentIds } = req.body; // Array of equipment IDs

    if (!Array.isArray(equipmentIds) || equipmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Equipment IDs array is required'
      });
    }

    // Verify set exists
    const [set] = await pool.query(
      'SELECT id FROM equipment_sets WHERE setId = ?',
      [setId]
    );

    if (set.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'PC set not found'
      });
    }

    // Verify equipment exists and is not already in another set
    for (const eqId of equipmentIds) {
      const [eqRows] = await pool.query(
        'SELECT id, setId, status, equipmentId, serialNumber FROM equipment WHERE id = ? LIMIT 1',
        [eqId]
      );
      if (!eqRows.length) {
        return res.status(404).json({ success: false, message: `Equipment ID ${eqId} not found.` });
      }
      const eq = eqRows[0];
      if (eq.setId && eq.setId !== setId) {
        return res.status(409).json({
          success: false,
          message: `Equipment ${eq.equipmentId} is already assigned to Set ${eq.setId}. Use the Transfer endpoint to move it.`
        });
      }
    }

    // Update equipment — only assign to set if not Missing
    const placeholders = equipmentIds.map(() => '?').join(',');
    await pool.query(`
      UPDATE equipment 
      SET setId = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders}) AND (status != 'Missing')
    `, [setId, ...equipmentIds]);

    // Recalculate set status
    await recalculateSetStatusInternal(setId);

    res.json({
      success: true,
      message: `${equipmentIds.length} component(s) added to set`
    });
  } catch (error) {
    console.error('Error adding components to set:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add components to set',
      error: error.message
    });
  }
}

// Remove equipment from set
export async function removeComponentFromSet(req, res) {
  try {
    const { setId, equipmentId } = req.params;

    // Check current equipment status — NEVER clear setId for Missing equipment
    const [eqRows] = await pool.query(
      'SELECT id, status, equipmentId AS eqCode, serialNumber FROM equipment WHERE id = ? LIMIT 1',
      [equipmentId]
    );

    if (!eqRows.length) {
      return res.status(404).json({ success: false, message: 'Component not found' });
    }

    const eq = eqRows[0];
    if (String(eq.status || '').toLowerCase() === 'missing') {
      return res.status(409).json({
        success: false,
        message: `Cannot remove Missing equipment (${eq.eqCode}) from its set. The set relationship must be preserved. Mark it as Found first.`
      });
    }

    // Remove from set (only for non-Missing equipment)
    const [result] = await pool.query(`
      UPDATE equipment 
      SET setId = NULL, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND setId = ? AND status != 'Missing'
    `, [equipmentId, setId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Component not found in this set or cannot be removed (Missing equipment cannot be detached)'
      });
    }

    // Recalculate set status
    await recalculateSetStatusInternal(setId);

    res.json({
      success: true,
      message: 'Component removed from set'
    });
  } catch (error) {
    console.error('Error removing component from set:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove component from set',
      error: error.message
    });
  }
}

// Get PC set statistics
export async function getPCSetStatistics(req, res) {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT es.id) as totalSets,
        SUM(CASE WHEN es.status = 'active' THEN 1 ELSE 0 END) as activeSets,
        SUM(CASE WHEN es.status = 'incomplete' THEN 1 ELSE 0 END) as incompleteSets,
        SUM(CASE WHEN es.status = 'maintenance' THEN 1 ELSE 0 END) as maintenanceSets,
        COUNT(e.id) as totalComponents
      FROM equipment_sets es
      LEFT JOIN equipment e ON e.setId = es.setId
    `);

    res.json({
      success: true,
      statistics: stats[0]
    });
  } catch (error) {
    console.error('Error fetching PC set statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
}
