const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'services', 'reports', 'kpiUserService.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Kita potong isi file tepat sebelum tulisan "// Head Of"
const splitMarker = '// Head Of';
const parts = content.split(splitMarker);

if (parts.length > 1) {
  // Tulis kembali bagian pertama saja
  fs.writeFileSync(filePath, parts[0].trim() + '\n', 'utf8');
  console.log('Successfully truncated getKPIHeadOf!');
} else {
  console.log('Split marker not found, check the file.');
}
