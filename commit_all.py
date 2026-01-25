import subprocess
import os

def run(cmd):
    try:
        subprocess.run(cmd, shell=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error running {cmd}: {e}")

# Get status
try:
    status = subprocess.check_output("git status --porcelain", shell=True).decode("utf-8")
except Exception as e:
    print(f"Failed to get git status: {e}")
    exit(1)

files = []
for line in status.splitlines():
    if not line.strip(): continue
    # porcelain format: XY PATH
    # We care about the path, starting at index 3
    file = line[3:]
    files.append(file)

print(f"Found {len(files)} files to commit.")

for file in files:
    # Message based on file
    basename = os.path.basename(file)
    msg = f"Update {basename}"
    
    if "Chat.tsx" in file: msg = "Fix chat UI overflow, scroll, and delete button visibility"
    elif "BuddyChat.tsx" in file: msg = "Fix BuddyChat text overflow"
    elif "Layout.tsx" in file: msg = "Enlarge sidebar buttons and add innovative hover effect"
    elif "card.tsx" in file: msg = "Update Card component with glassmorphism styles"
    elif "socket" in file: msg = "Update socket handlers"
    elif "routes" in file: msg = "Update API routes"
    elif file.endswith(".md"): msg = f"Add documentation: {basename}"
    elif "vercel.json" in file: msg = "Update Vercel configuration"
    
    # Add and commit
    print(f"Committing {file}...")
    run(f'git add "{file}"')
    run(f'git commit -m "{msg}"')

print("Pushing all commits...")
run("git push")
