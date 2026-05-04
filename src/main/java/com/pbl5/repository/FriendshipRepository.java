package com.pbl5.repository;

import com.pbl5.model.Friendship;
import com.pbl5.model.User;
import com.pbl5.enums.FriendshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    @Query("SELECT f FROM Friendship f WHERE (f.requester = :u1 AND f.receiver = :u2) OR (f.requester = :u2 AND f.receiver = :u1)")
    Optional<Friendship> findByUsers(@Param("u1") User u1, @Param("u2") User u2);

    List<Friendship> findByReceiverAndStatus(User receiver, FriendshipStatus status);

    @Query("SELECT f FROM Friendship f WHERE (f.requester = :user OR f.receiver = :user) AND f.status = :status")
    List<Friendship> findAllFriends(@Param("user") User user, @Param("status") FriendshipStatus status);
}
