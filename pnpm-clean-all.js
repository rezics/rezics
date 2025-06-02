// clean-all.js
import fs from 'fs';
import path from 'path';

function walkAndDelete(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file === 'node_modules') {
                console.log('Deleting', fullPath);
                fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
                walkAndDelete(fullPath);
            }
        } else if (file === 'package-lock.json' || file === 'pnpm-lock.yaml') {
            console.log('Deleting', fullPath);
            fs.rmSync(fullPath);
        }
    }
}

walkAndDelete(process.cwd());
