sed -i '' "s|alert('Lỗi khi tải ảnh lên!');|const errTxt = await uploadRes.text(); alert('Lỗi khi tải ảnh lên: ' + uploadRes.status + ' - ' + errTxt);|g" src/main/resources/static/js/profile.js
