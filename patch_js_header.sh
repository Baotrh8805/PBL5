sed -i '' "s|body: formData|headers: {'Authorization': \`Bearer \${token}\`},\n            body: formData|g" src/main/resources/static/js/profile.js
