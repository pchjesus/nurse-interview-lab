// Disposable in-process PostgreSQL (PGlite); no network, no external database URL.
// npm install --prefix /tmp/nurse-b2-pg --no-save @electric-sql/pglite@0.5.14
// node tests/sql/run-pglite.mjs /tmp/nurse-b2-pg
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {resolve, dirname} from 'node:path'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
if (!process.argv[2]) throw new Error('Pass the directory containing the disposable PGlite installation')
const requireFromTemp = createRequire(resolve(process.argv[2], 'package.json'))
const {PGlite} = await import(pathToFileURL(requireFromTemp.resolve('@electric-sql/pglite')).href)
const here = dirname(fileURLToPath(import.meta.url))
const read = path => readFileSync(resolve(here, path), 'utf8')
const sql = read('security.sql').replace('\\set ON_ERROR_STOP on', '').replace('\\ir ../../db/review/001_nurse_backup.sql', () => read('../../db/review/001_nurse_backup.sql'))
const pg = new PGlite() // in-memory only; never accepts a connection string
try { await pg.exec(sql); console.log('PASS: isolated PGlite security.sql') }
finally { await pg.close() }
