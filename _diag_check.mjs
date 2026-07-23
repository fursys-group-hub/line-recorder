import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const html = readFileSync('C:\\Users\\FURSYS\\Desktop\\깃허브 앱 파일 정리\\scp-line-analyzer-main\\index.html','utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
console.log('인라인 script 블록 수:', scripts.length, '| 길이:', scripts.map(s=>s.length));
const main = scripts.slice().sort((a,b)=>b.length-a.length)[0];
writeFileSync('_check_main.js', main, 'utf8');
try {
  execSync('node --check _check_main.js', { cwd: 'C:\\Users\\FURSYS\\Desktop\\line-recorder-main', stdio: 'pipe' });
  console.log('✅ 문법 검사 통과 (node --check)');
} catch (e) {
  console.log('❌ 문법 오류:\n', e.stderr?.toString() || e.stdout?.toString() || e.message);
}
