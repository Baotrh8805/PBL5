sed -i '' 's|alert('\''Lỗi khi tải ảnh lên!'\'');|const text = await uploadRes.text(); alert('\''Lỗi khi tải ảnh lên: '\'' + text);|g' src/main/resources/static/js/profile.js
