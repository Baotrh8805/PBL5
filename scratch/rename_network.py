import os

files_to_update = [
    "/Users/thinguyen/năm3 kì 2/pbl5/src/main/resources/static/index.html",
    "/Users/thinguyen/năm3 kì 2/pbl5/src/main/resources/static/html/home.html",
    "/Users/thinguyen/năm3 kì 2/pbl5/src/main/resources/static/html/friends.html",
    "/Users/thinguyen/năm3 kì 2/pbl5/src/main/resources/static/html/bookmarks.html",
    "/Users/thinguyen/năm3 kì 2/pbl5/src/main/resources/static/html/profile.html",
    "/Users/thinguyen/năm3 kì 2/pbl5/src/main/resources/static/html/post.html",
    "/Users/thinguyen/năm3 kì 2/pbl5/src/main/resources/static/html/admin.html",
    "/Users/thinguyen/năm3 kì 2/pbl5/src/main/resources/static/html/moderator.html",
    "/Users/thinguyen/năm3 kì 2/pbl5/src/main/java/com/pbl5/service/EmailService.java",
    "/Users/thinguyen/năm3 kì 2/pbl5/src/main/resources/static/js/moderator_core.js"
]

for file_path in files_to_update:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Count replacements
        count_lc = content.count("LC Network")
        count_lc_caps = content.count("LC NETWORK")
        
        # Replace
        new_content = content.replace("LC Network", "BD Network")
        new_content = new_content.replace("LC NETWORK", "BD NETWORK")
        
        # Save back if changed
        if new_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {os.path.basename(file_path)}: replaced {count_lc} 'LC Network' and {count_lc_caps} 'LC NETWORK'")
        else:
            print(f"No changes for {os.path.basename(file_path)}")
    else:
        print(f"File not found: {file_path}")
