const database = require('../database/database');
(async () => {
  await database.init();
  try { await database.run('ALTER TABLE tasks ADD COLUMN category TEXT'); } catch(e) {}
  try { await database.run('ALTER TABLE tasks ADD COLUMN tags TEXT'); } catch(e) {}
  process.exit(0);
})();
