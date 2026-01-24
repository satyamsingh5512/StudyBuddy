import subprocess
import os

def run_command(command):
    try:
        result = subprocess.run(command, shell=True, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running command '{command}': {e.stderr}")
        return None

def get_git_status():
    output = run_command("git status --porcelain")
    files = []
    if output:
        for line in output.split('\n'):
            status = line[:2]
            file_path = line[3:].strip()
            # Handle quoted filenames if any
            if file_path.startswith('"') and file_path.endswith('"'):
                file_path = file_path[1:-1]
            files.append((status, file_path))
    return files

def main():
    print("Starting individual push process...")
    status_list = get_git_status()
    
    if not status_list:
        print("No changes to commit.")
        return

    print(f"Found {len(status_list)} files to process.")

    for status, file_path in status_list:
        print(f"Processing ({status}): {file_path}")
        
        # Add the file
        run_command(f'git add "{file_path}"')
        
        # Determine commit message
        if 'D' in status:
            msg = f"Delete {os.path.basename(file_path)} [skip ci]"
        elif '?' in status:
             msg = f"Add {os.path.basename(file_path)} [skip ci]"
        else:
            msg = f"Update {os.path.basename(file_path)} [skip ci]"
            
        # Commit
        commit_out = run_command(f'git commit -m "{msg}"')
        if commit_out:
            print(f"Committed: {msg}")
            
            # Push immediately
            push_out = run_command("git push")
            if push_out is not None: 
                print(f"Pushed {file_path}")
            else:
                print(f"Failed to push {file_path}")
        else:
            print(f"Failed to commit {file_path}")

    print("All files processed.")

if __name__ == "__main__":
    main()
