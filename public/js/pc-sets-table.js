// PC Sets Table with Expandable Rows - Integrated Equipment Inventory

function getCategoryIcon(component) {
    if (!component) return 'fas fa-cube';
    const comp = String(component).toLowerCase();
    if (comp.includes('cpu')) return 'fas fa-microchip';
    if (comp.includes('monitor')) return 'fas fa-desktop';
    if (comp.includes('keyboard')) return 'fas fa-keyboard';
    if (comp.includes('mouse')) return 'fas fa-mouse';
    if (comp.includes('avr')) return 'fas fa-plug';
    return 'fas fa-cube';
}

async function loadPCSetsTable() {
    try {
        const response = await fetch('/api/equipment-sets');
        if (!response.ok) throw new Error('Failed to fetch PC sets');
        
        const data = await response.json();
        if (data.success) {
            renderPCSetsTable(data.sets);
        }
    } catch (error) {
        console.error('Error loading PC sets:', error);
        alert('Failed to load PC sets');
    }
}

function renderPCSetsTable(sets) {
    const thead = document.getElementById('tableHeaderRow');
    const tbody = document.getElementById('equipmentTable');
    
    // Update table headers for PC sets view
    thead.innerHTML = `
        <th class="px-5 py-3 text-left text-sm font-semibold text-slate-300 uppercase" style="width: 50px;"></th>
        <th class="px-5 py-3 text-left text-sm font-semibold text-slate-300 uppercase">PC Station ID</th>
        <th class="px-5 py-3 text-left text-sm font-semibold text-slate-300 uppercase">Station Name</th>
        <th class="px-5 py-3 text-left text-sm font-semibold text-slate-300 uppercase">Lab / Location</th>
        <th class="px-5 py-3 text-left text-sm font-semibold text-slate-300 uppercase">Equipment Count</th>
        <th class="px-5 py-3 text-left text-sm font-semibold text-slate-300 uppercase">Availability</th>
        <th class="px-5 py-3 text-left text-sm font-semibold text-slate-300 uppercase">Actions</th>
    `;
    
    if (!sets || sets.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-5 py-8 text-center">
                    <div class="flex flex-col items-center gap-3">
                        <i class="fas fa-desktop text-4xl text-emerald-800"></i>
                        <p class="text-slate-400">No PC sets found</p>
                        <button onclick="createNewPCSet()" class="btn-primary rounded-lg px-4 py-2 text-sm">
                            <i class="fas fa-plus mr-2"></i>Create PC Set
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = sets.map((set) => {
        const statusMap = {
            'active':      { label: '✔ Ready to Use',    style: 'background:rgba(34,197,94,.15);color:#86efac;border:1px solid rgba(34,197,94,.3);' },
            'incomplete':  { label: '⚠ Missing Component', style: 'background:rgba(251,191,36,.15);color:#fcd34d;border:1px solid rgba(251,191,36,.3);' },
            'maintenance': { label: '🔧 Under Maintenance', style: 'background:rgba(139,92,246,.15);color:#c4b5fd;border:1px solid rgba(139,92,246,.3);' },
            'retired':     { label: '✕ Retired',           style: 'background:rgba(107,114,128,.15);color:#d1d5db;border:1px solid rgba(107,114,128,.3);' },
        };
        const st = statusMap[set.status] || statusMap['incomplete'];
        const missing = Number(set.missingCount || 0);
        const total   = Number(set.componentCount || 0);

        return `
            <tr class="group hover:bg-emerald-950/30 transition-colors border-b border-emerald-900/20" data-set-id="${set.setId}">
                <td class="px-5 py-4">
                    <button onclick="togglePCSetExpand('${set.setId}')"
                            class="text-emerald-400 hover:text-emerald-300 transition-transform duration-200"
                            id="expand-btn-${set.setId}" title="Show / hide equipment">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </td>
                <td class="px-5 py-4">
                    <span class="font-mono text-emerald-400 font-bold text-sm">${set.setId}</span>
                </td>
                <td class="px-5 py-4">
                    <div class="font-semibold text-white">${set.setName}</div>
                    ${set.description ? `<div class="text-xs text-slate-400 mt-1">${set.description}</div>` : ''}
                </td>
                <td class="px-5 py-4 text-slate-300 text-sm">
                    ${set.location
                        ? `<span class="flex items-center gap-1"><i class="fas fa-map-marker-alt text-emerald-500 text-xs"></i>${set.location}</span>`
                        : '<span class="text-slate-600 italic text-xs">Not specified</span>'}
                </td>
                <td class="px-5 py-4">
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-white font-semibold">${total} piece${total !== 1 ? 's' : ''}</span>
                        ${missing > 0
                            ? `<span class="text-xs font-semibold" style="color:#fcd34d;"><i class="fas fa-exclamation-triangle mr-1"></i>${missing} missing</span>`
                            : `<span class="text-xs text-emerald-600">All accounted for</span>`}
                    </div>
                </td>
                <td class="px-5 py-4">
                    <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" style="${st.style}">
                        ${st.label}
                    </span>
                </td>
                <td class="px-5 py-4">
                    <div class="flex items-center gap-2">
                        <button onclick="editPCSetInline('${set.setId}')"
                                class="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/30 transition-colors">
                            <i class="fas fa-edit mr-1"></i>Edit
                        </button>
                        <button onclick="deletePCSetInline('${set.setId}', ${total})"
                                class="rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/30 transition-colors">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
            <tr id="expanded-${set.setId}" class="hidden bg-emerald-950/20">
                <td colspan="7" class="px-5 py-4">
                    <div class="pl-12">
                        <div class="flex items-center justify-between mb-3">
                            <div>
                                <h4 class="text-sm font-bold text-emerald-400 uppercase tracking-wide">
                                    <i class="fas fa-desktop mr-2"></i>${set.setName} — Equipment List
                                </h4>
                            </div>
                            <button onclick="addComponentsModal('${set.setId}')"
                                    class="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors">
                                <i class="fas fa-plus mr-1"></i>Add Equipment
                            </button>
                        </div>
                        <div id="components-list-${set.setId}" class="space-y-1.5">
                            <div class="text-center text-slate-400 py-2">
                                <i class="fas fa-spinner fa-spin mr-2"></i>Loading equipment list...
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function togglePCSetExpand(setId) {
    const expandedRow = document.getElementById(`expanded-${setId}`);
    const expandBtn = document.getElementById(`expand-btn-${setId}`);
    const icon = expandBtn.querySelector('i');
    
    if (expandedRow.classList.contains('hidden')) {
        // Expand - load components
        expandedRow.classList.remove('hidden');
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-down');
        await loadPCSetComponents(setId);
    } else {
        // Collapse
        expandedRow.classList.add('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-right');
    }
}

async function loadPCSetComponents(setId) {
    const container = document.getElementById(`components-list-${setId}`);
    
    try {
        const response = await fetch(`/api/equipment-sets/${setId}`);
        const data = await response.json();
        
        if (data.success && data.components) {
            if (data.components.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-slate-500 py-6">
                        <i class="fas fa-inbox text-2xl mb-2 block"></i>
                        <p class="text-sm">No equipment added yet.</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:1px solid rgba(74,222,128,.1);">
                                <th style="padding:6px 12px;text-align:left;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(100,180,130,.5);width:35%;">Equipment Name</th>
                                <th style="padding:6px 12px;text-align:left;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(100,180,130,.5);width:15%;">Type</th>
                                <th style="padding:6px 12px;text-align:left;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(100,180,130,.5);width:20%;">Serial Number</th>
                                <th style="padding:6px 12px;text-align:left;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(100,180,130,.5);width:18%;">Condition</th>
                                <th style="padding:6px 12px;width:12%;"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.components.map(comp => {
                                const icon = getCategoryIcon(comp.category);
                                const isMissing = comp.status === 'Missing';
                                const isUnderMaint = comp.status === 'Under Maintenance';

                                const conditionBadge = isMissing
                                    ? `<span style="background:rgba(251,191,36,.2);color:#fcd34d;padding:3px 10px;border-radius:999px;font-size:0.7rem;font-weight:700;">MISSING</span>`
                                    : isUnderMaint
                                        ? `<span style="background:rgba(139,92,246,.2);color:#c4b5fd;padding:3px 10px;border-radius:999px;font-size:0.7rem;font-weight:700;">MAINTENANCE</span>`
                                        : `<span style="background:rgba(34,197,94,.15);color:#86efac;padding:3px 10px;border-radius:999px;font-size:0.7rem;font-weight:600;">Serviceable</span>`;

                                return `
                                    <tr style="border-bottom:1px solid rgba(74,222,128,.06);${isMissing ? 'opacity:0.7;' : ''}">
                                        <td style="padding:10px 12px;">
                                            <div style="display:flex;align-items:center;gap:10px;">
                                                <div style="width:30px;height:30px;border-radius:8px;background:rgba(34,197,94,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                                    <i class="${icon}" style="color:#6ee7b7;font-size:0.75rem;"></i>
                                                </div>
                                                <span style="font-size:0.875rem;font-weight:600;color:${isMissing ? '#6b7280' : '#f8fafc'};${isMissing ? 'text-decoration:line-through;' : ''}">${comp.name}</span>
                                            </div>
                                        </td>
                                        <td style="padding:10px 12px;font-size:0.8rem;color:#94a3b8;">${comp.category}</td>
                                        <td style="padding:10px 12px;font-size:0.8rem;font-family:monospace;color:#cbd5e1;">${comp.serialNumber || '—'}</td>
                                        <td style="padding:10px 12px;">${conditionBadge}</td>
                                        <td style="padding:10px 12px;text-align:right;">
                                            ${!isMissing
                                                ? `<button onclick="removeComponentFromSetInline('${setId}', ${comp.id})"
                                                        style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#fca5a5;padding:4px 12px;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer;">
                                                        <i class="fas fa-times" style="margin-right:4px;"></i>Remove
                                                   </button>`
                                                : `<span style="font-size:0.7rem;color:rgba(251,191,36,.4);font-style:italic;">Locked</span>`
                                            }
                                        </td>
                                    </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading components:', error);
        container.innerHTML = `
            <div class="text-center text-red-400 py-4">
                <i class="fas fa-exclamation-circle mr-2"></i>Failed to load equipment list
            </div>
        `;
    }
}

function createNewPCSet() {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content mx-auto w-full max-w-2xl">
            <div class="flex items-start justify-between mb-6">
                <div>
                    <h3 class="text-2xl font-bold text-white">Create New PC Set</h3>
                    <p class="text-slate-400 mt-1">Add a new PC station set</p>
                </div>
                <button onclick="this.closest('.modal').remove()" class="text-2xl text-emerald-400 hover:text-emerald-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="createPCSetForm">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-emerald-300 mb-2">Set ID *</label>
                        <input type="text" id="newSetId" placeholder="e.g., PC-SET-006" 
                               class="w-full rounded-lg border border-emerald-800/60 bg-[#060e0a] px-4 py-3 text-emerald-100 focus:border-emerald-500 focus:outline-none" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-emerald-300 mb-2">Set Name *</label>
                        <input type="text" id="newSetName" placeholder="e.g., PC Station 006" 
                               class="w-full rounded-lg border border-emerald-800/60 bg-[#060e0a] px-4 py-3 text-emerald-100 focus:border-emerald-500 focus:outline-none" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-emerald-300 mb-2">Description</label>
                        <textarea id="newDescription" rows="2" placeholder="Optional description..." 
                                  class="w-full rounded-lg border border-emerald-800/60 bg-[#060e0a] px-4 py-3 text-emerald-100 focus:border-emerald-500 focus:outline-none"></textarea>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-emerald-300 mb-2">Location</label>
                        <input type="text" id="newLocation" placeholder="e.g., Row 1, Position 3" 
                               class="w-full rounded-lg border border-emerald-800/60 bg-[#060e0a] px-4 py-3 text-emerald-100 focus:border-emerald-500 focus:outline-none">
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button type="button" onclick="this.closest('.modal').remove()" 
                            class="flex-1 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-4 py-2.5 text-emerald-300 hover:bg-emerald-900/50 font-semibold">
                        Cancel
                    </button>
                    <button type="submit" 
                            class="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-white font-semibold hover:bg-emerald-500">
                        <i class="fas fa-plus mr-2"></i>Create
                    </button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('createPCSetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await savePCSet();
    });
}

async function savePCSet() {
    const setId = document.getElementById('newSetId').value.trim();
    const setName = document.getElementById('newSetName').value.trim();
    const description = document.getElementById('newDescription').value.trim();
    const location = document.getElementById('newLocation').value.trim();
    
    try {
        const response = await fetch('/api/equipment-sets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ setId, setName, description, location, status: 'incomplete' })
        });
        
        const data = await response.json();
        if (data.success) {
            document.querySelectorAll('.modal').forEach(m => m.remove());
            await loadPCSetsTable();
            alert('PC set created successfully!');
        } else {
            alert(data.message || 'Failed to create PC set');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to create PC set');
    }
}

async function editPCSetInline(setId) {
    try {
        const response = await fetch(`/api/equipment-sets/${setId}`);
        const data = await response.json();
        
        if (data.success) {
            const set = data.set;
            const modal = document.createElement('div');
            modal.className = 'modal show';
            modal.innerHTML = `
                <div class="modal-content mx-auto w-full max-w-2xl">
                    <div class="flex items-start justify-between mb-6">
                        <div>
                            <h3 class="text-2xl font-bold text-white">Edit PC Set</h3>
                            <p class="text-slate-400 mt-1">${setId}</p>
                        </div>
                        <button onclick="this.closest('.modal').remove()" class="text-2xl text-emerald-400 hover:text-emerald-200">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <form id="editPCSetForm">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-emerald-300 mb-2">Set Name *</label>
                                <input type="text" id="editSetName" value="${set.setName}" 
                                       class="w-full rounded-lg border border-emerald-800/60 bg-[#060e0a] px-4 py-3 text-emerald-100 focus:border-emerald-500 focus:outline-none" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-emerald-300 mb-2">Description</label>
                                <textarea id="editDescription" rows="2" 
                                          class="w-full rounded-lg border border-emerald-800/60 bg-[#060e0a] px-4 py-3 text-emerald-100 focus:border-emerald-500 focus:outline-none">${set.description || ''}</textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-emerald-300 mb-2">Location</label>
                                <input type="text" id="editLocation" value="${set.location || ''}" 
                                       class="w-full rounded-lg border border-emerald-800/60 bg-[#060e0a] px-4 py-3 text-emerald-100 focus:border-emerald-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-emerald-300 mb-2">Status</label>
                                <select id="editStatus" 
                                        class="w-full rounded-lg border border-emerald-800/60 bg-[#060e0a] px-4 py-3 text-emerald-100 focus:border-emerald-500 focus:outline-none">
                                    <option value="incomplete" ${set.status === 'incomplete' ? 'selected' : ''}>Incomplete</option>
                                    <option value="active" ${set.status === 'active' ? 'selected' : ''}>Active</option>
                                    <option value="maintenance" ${set.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
                                    <option value="retired" ${set.status === 'retired' ? 'selected' : ''}>Retired</option>
                                </select>
                            </div>
                        </div>
                        <div class="flex gap-3 mt-6">
                            <button type="button" onclick="this.closest('.modal').remove()" 
                                    class="flex-1 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-4 py-2.5 text-emerald-300 hover:bg-emerald-900/50 font-semibold">
                                Cancel
                            </button>
                            <button type="submit" 
                                    class="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-white font-semibold hover:bg-emerald-500">
                                <i class="fas fa-save mr-2"></i>Update
                            </button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);
            
            document.getElementById('editPCSetForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                await updatePCSet(setId);
            });
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load PC set details');
    }
}

async function updatePCSet(setId) {
    const setName = document.getElementById('editSetName').value.trim();
    const description = document.getElementById('editDescription').value.trim();
    const location = document.getElementById('editLocation').value.trim();
    const status = document.getElementById('editStatus').value;
    
    try {
        const response = await fetch(`/api/equipment-sets/${setId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ setName, description, location, status })
        });
        
        const data = await response.json();
        if (data.success) {
            document.querySelectorAll('.modal').forEach(m => m.remove());
            await loadPCSetsTable();
            alert('PC set updated successfully!');
        } else {
            alert(data.message || 'Failed to update PC set');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to update PC set');
    }
}

async function deletePCSetInline(setId, componentCount) {
    if (componentCount > 0) {
        alert(`Cannot delete this PC set. It has ${componentCount} component(s). Remove all components first.`);
        return;
    }
    
    if (!confirm(`Delete ${setId}? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/equipment-sets/${setId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            await loadPCSetsTable();
            alert('PC set deleted successfully!');
        } else {
            alert(data.message || 'Failed to delete PC set');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to delete PC set');
    }
}

async function addComponentsModal(setId) {
    try {
        const response = await fetch('/api/equipment/available-for-sets');
        const data = await response.json();
        
        if (data.success) {
            const modal = document.createElement('div');
            modal.className = 'modal show';
            modal.innerHTML = `
                <div class="modal-content mx-auto w-full max-w-3xl">
                    <div class="flex items-start justify-between mb-6">
                        <div>
                            <h3 class="text-2xl font-bold text-white">Add Components</h3>
                            <p class="text-slate-400 mt-1">Select equipment to add to ${setId}</p>
                        </div>
                        <button onclick="this.closest('.modal').remove()" class="text-2xl text-emerald-400 hover:text-emerald-200">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="space-y-2 max-h-96 overflow-y-auto mb-6" id="availableEquipmentList">
                        ${data.equipment.length === 0 ? 
                            '<div class="text-center text-slate-400 py-8">No available equipment</div>' :
                            data.equipment.map(item => `
                                <label class="flex items-start gap-3 p-3 bg-[#0d1e17] border border-emerald-800/40 rounded-lg cursor-pointer hover:border-emerald-600/40 transition-colors">
                                    <input type="checkbox" value="${item.id}" class="mt-1 component-checkbox" />
                                    <div class="flex-1">
                                        <div class="font-semibold text-white">${item.name}</div>
                                        <div class="text-sm text-slate-400 mt-1">
                                            ${item.category} • SN: ${item.serialNumber || 'N/A'} • ${item.campus || 'N/A'}
                                        </div>
                                    </div>
                                </label>
                            `).join('')
                        }
                    </div>

                    <div class="flex gap-3">
                        <button type="button" onclick="this.closest('.modal').remove()" 
                                class="flex-1 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-4 py-2.5 text-emerald-300 hover:bg-emerald-900/50 font-semibold">
                            Cancel
                        </button>
                        <button type="button" onclick="saveSelectedComponentsInline('${setId}')" 
                                class="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-white font-semibold hover:bg-emerald-500">
                            <i class="fas fa-check mr-2"></i>Add Selected
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load available equipment');
    }
}

async function saveSelectedComponentsInline(setId) {
    const checkboxes = document.querySelectorAll('.component-checkbox:checked');
    const equipmentIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (equipmentIds.length === 0) {
        alert('Please select at least one component');
        return;
    }

    try {
        const response = await fetch(`/api/equipment-sets/${setId}/components`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ equipmentIds })
        });

        const data = await response.json();
        if (data.success) {
            document.querySelectorAll('.modal').forEach(m => m.remove());
            await loadPCSetsTable();
            // Expand the row to show new components
            const expandedRow = document.getElementById(`expanded-${setId}`);
            if (expandedRow.classList.contains('hidden')) {
                await togglePCSetExpand(setId);
            } else {
                await loadPCSetComponents(setId);
            }
            alert(data.message);
        } else {
            alert(data.message || 'Failed to add components');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to add components');
    }
}

async function removeComponentFromSetInline(setId, componentId) {
    if (!confirm('Remove this component from the set?')) return;

    try {
        const response = await fetch(`/api/equipment-sets/${setId}/components/${componentId}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (data.success) {
            await loadPCSetComponents(setId);
            await loadPCSetsTable(); // Refresh to update component count
        } else {
            alert(data.message || 'Failed to remove component');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to remove component');
    }
}
