import fs from 'fs';
const content = fs.readFileSync('client/src/pages/dashboard.tsx', 'utf-8').split('\n');
const output = [];
for (let i = 0; i < content.length; i++) {
  const line = content[i].trim();
  if (line.includes('<div') || line.includes('<motion.div')) {
    output.push(`OPEN: ${i + 1}: ${line}`);
  }
  if (line.includes('</div>') || line.includes('</motion.div>')) {
    output.push(`CLOSE: ${i + 1}: ${line}`);
  }
}
fs.writeFileSync('div_trace.txt', output.join('\n'));





