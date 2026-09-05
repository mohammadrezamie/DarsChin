import json

with open('package.json', 'r') as f:
    pkg = json.load(f)

deps_to_move = ['@tailwindcss/vite', '@types/jalaali-js', '@vitejs/plugin-react', 'vite']

for dep in deps_to_move:
    if dep in pkg['dependencies']:
        pkg['devDependencies'][dep] = pkg['dependencies'][dep]
        del pkg['dependencies'][dep]

with open('package.json', 'w') as f:
    json.dump(pkg, f, indent=2)

