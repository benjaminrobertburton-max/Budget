import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:net';
import {acquireWeeklyLock,assertLoopbackAvailable} from '../src/weekly-preflight.mjs';
import {tempDirectory} from './store-helpers.mjs';

test('only one weekly process can own a private store',async t=>{
  const root=await tempDirectory(t),release=await acquireWeeklyLock(root);
  await assert.rejects(acquireWeeklyLock(root),{code:'COLLECTOR_ALREADY_RUNNING'});
  await release();await (await acquireWeeklyLock(root))();
});
test('a dead owner can be recovered; unreadable locks fail closed without deleting them',async t=>{
  const root=await tempDirectory(t),filename=path.join(root,'weekly-refresh.lock');
  await fs.writeFile(filename,JSON.stringify({version:1,pid:123,token:'fictional'}));
  await (await acquireWeeklyLock(root,{alive:()=>false}))();
  await fs.writeFile(filename,'broken');
  await assert.rejects(acquireWeeklyLock(root),{code:'LOCK_INVALID'});
  assert.equal(await fs.readFile(filename,'utf8'),'broken');
});
test('busy loopback is a preflight failure, not a bank failure',async t=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  await assert.rejects(assertLoopbackAvailable(server.address().port),{code:'LOCAL_BRIDGE_IN_USE'});
});
