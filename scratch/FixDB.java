import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

public class FixDB {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:postgresql://aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?prepareThreshold=0";
        String user = "postgres.bgmwwohtvcpfpwzhkbkx";
        String pass = "ft73#xYy/p5C!*X";
        
        try (Connection conn = DriverManager.getConnection(url, user, pass);
             Statement stmt = conn.createStatement()) {
            stmt.executeUpdate("ALTER TABLE messages ALTER COLUMN receiver_id DROP NOT NULL;");
            System.out.println("Constraint dropped successfully!");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
