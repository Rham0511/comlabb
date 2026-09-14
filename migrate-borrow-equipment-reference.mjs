import { sequelize } from "./models/db.js";
import { QueryTypes } from "sequelize";

const columnName = "equipment_record_id";
const tables = ["borrow_records", "borrow_histories"];

try {
  await sequelize.authenticate();

  for (const table of tables) {
    const columns = await sequelize.query(
      `SHOW COLUMNS FROM \`${table}\` LIKE '${columnName}'`,
      { type: QueryTypes.SELECT }
    );

    if (columns.length === 0) {
      await sequelize.query(
        `ALTER TABLE \`${table}\` ADD COLUMN \`${columnName}\` INT NULL DEFAULT NULL`
      );
      console.log(`Added ${table}.${columnName}.`);
    } else {
      console.log(`${table}.${columnName} already exists.`);
    }
  }

  console.log("Borrow equipment reference schema migration completed. No data rows were changed.");
} finally {
  await sequelize.close();
}
