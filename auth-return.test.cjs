const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const context={exports:{},URL};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(__dirname+'/apps/web/app/auth-return.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
const {safeNext}=context.exports;
test('login returns only to local pages, preventing normalized open redirects and login loops',()=>{
 for(const value of [null,'https://evil.example','//evil.example','/\\evil.example','/\n/evil.example','/\r/evil.example','/login','/login?next=//evil.example','/account/password?required=1'])assert.equal(safeNext(value),'/history');
 for(const value of ['/history?page=2&limit=10','/calculator?record=abc&version=2','/feishu','/admin/users'])assert.equal(safeNext(value),value);
});
