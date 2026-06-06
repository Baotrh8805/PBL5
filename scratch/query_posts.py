import sys
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')

conn = psycopg2.connect(
    dbname="postgres",
    user="postgres.bgmwwohtvcpfpwzhkbkx",
    password="ft73#xYy/p5C!*X",
    host="aws-1-ap-southeast-1.pooler.supabase.com",
    port="6543"
)

cur = conn.cursor()
cur.execute("SELECT id, video_url, speech_labels, hate_speech_word, status, hate_speech_score FROM posts WHERE id = 174;")
row = cur.fetchone()
if row:
    print(f"ID: {row[0]}")
    print(f"Video URL: {row[1]}")
    print(f"Speech Labels: {row[2]}")
    print(f"Hate Speech Word: {row[3]}")
    print(f"Status: {row[4]}")
    print(f"Hate Speech Score: {row[5]}")
else:
    print("Post 174 not found.")

cur.close()
conn.close()
