import { faker } from '@faker-js/faker';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';

async function generateUsers(client, db) {
  const userCount = 1000;
  const userIDs = Array.from({ length: userCount }, () => new ObjectId());

  const usersCollection = [];
  const userPostsMap = {}; // Map to store user ID and corresponding post IDs

  for (const userID of userIDs) {
    const numFriends = Math.floor(Math.random() * userCount);
    const friendsSubset = [];

    while (friendsSubset.length < numFriends) {
      const randomIndex = Math.floor(Math.random() * userCount);
      const friendID = userIDs[randomIndex];

      if (!friendID.equals(userID) && !friendsSubset.includes(friendID)) {
        friendsSubset.push(friendID);
      }
    }

    const gender = faker.person.sex();
    const plainPassword = faker.internet.password({ length: 8, pattern: /[A-Za-z0-9]/ });
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const userData = {
      _id: userID,
      name: {
        first_name: faker.person.firstName(gender),
        last_name: faker.person.lastName(),
      },
      password: hashedPassword,
      gender: gender,
      age: faker.date.birthdate({ min: 6, max: 100, mode: 'age' }),
      email: faker.internet.email(),
      contact_number: faker.phone.number(),
      address: {
        country: faker.location.country(),
        city: faker.location.city(),
      },
      friends: friendsSubset.map(id => id),
      photos: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => faker.image.avatar()),
    };

    usersCollection.push(userData);
  }

  const result = await db.collection('users').insertMany(usersCollection);
  console.log(`${result.insertedCount} users inserted.`);

  return userPostsMap;
}

async function generateConversations(client, db) {
  const userIDs = await db.collection('users').distinct('_id');

  const conversationsCollection = [];

  for (const userID of userIDs) {
    const user = await db.collection('users').findOne({ _id: userID });

    if (user && user.friends && user.friends.length > 0) {
      const friendID = faker.helpers.arrayElement(user.friends);
      const friend = await db.collection('users').findOne({ _id: friendID });

      if (friend) {
        const creatorID = faker.helpers.arrayElement([user._id, friend._id]);
        const recipientID = creatorID.equals(user._id) ? friend._id : user._id;

        const numMessages = Math.floor(Math.random() * 10) + 1;

        const messages = Array.from({ length: numMessages }, () => ({
          user_id: creatorID,
          friend_id: recipientID,
          message: faker.lorem.sentence(),
          created_at: faker.date.past(),
          updated_at: faker.date.recent(),
        }));

        const conversationData = {
          _id: new ObjectId(),
          friend_id: recipientID,
          messages: messages,
        };

        conversationsCollection.push(conversationData);
      }
    }
  }

  const result = await db.collection('conversations').insertMany(conversationsCollection);
  console.log(`${result.insertedCount} conversations inserted.`);
}

async function generatePosts(client, db, userPostsMap) {
    const userIDs = await db.collection('users').distinct('_id');
  
    const postsCollection = [];
    const commentsCollection = [];
  
    for (const userID of userIDs) {
      const numPosts = Math.floor(Math.random() * 5) + 1;
  
      for (let i = 0; i < numPosts; i++) {
        const numLikes = Math.floor(Math.random() * userIDs.length);
  
        const likesSubset = [];
        while (likesSubset.length < numLikes) {
          const randomIndex = Math.floor(Math.random() * userIDs.length);
          const likeUserID = userIDs[randomIndex];
  
          if (!likesSubset.includes(likeUserID)) {
            likesSubset.push(likeUserID);
          }
        }
  
        const comments = [];
        const numComments = Math.floor(Math.random() * 5) + 1;
  
        for (let j = 0; j < numComments; j++) {
          const commentUserID = faker.helpers.arrayElement(userIDs);
          const commentLikesSubset = [];
          
          // Generate random likes for comments
          const numCommentLikes = Math.floor(Math.random() * userIDs.length);
          while (commentLikesSubset.length < numCommentLikes) {
            const randomIndex = Math.floor(Math.random() * userIDs.length);
            const commentLikeUserID = userIDs[randomIndex];
  
            if (!commentLikesSubset.includes(commentLikeUserID)) {
              commentLikesSubset.push(commentLikeUserID);
            }
          }
  
          const commentData = {
            _id: new ObjectId(),
            post_id: null, // Placeholder for post_id, will be updated later
            text: faker.lorem.sentence(),
            created_at: faker.date.past(),
            updated_at: faker.date.recent(),
            likes: commentLikesSubset,
            user_id: commentUserID,
          };
  
          comments.push(commentData);
          commentsCollection.push(commentData);
        }
  
        const postData = {
          _id: new ObjectId(),
          user_id: userID,
          text: faker.lorem.paragraph(),
          created_at: faker.date.past(),
          updated_at: faker.date.recent(),
          likes: likesSubset,
          photos: Array.from({ length: Math.floor(Math.random() * 3) }, () => faker.image.url()),
          comments: comments.map(comment => comment._id),
        };
  
        postsCollection.push(postData);
  
        // Update comments with the correct post_id
        comments.forEach(comment => {
          comment.post_id = postData._id;
        });
  
        // Update userPostsMap with the post ID
        if (!userPostsMap[userID]) {
          userPostsMap[userID] = [];
        }
        userPostsMap[userID].push(postData._id);
      }
    }
  
    // Insert comments 
    await db.collection('comments').insertMany(commentsCollection);
  
    // Insert posts 
    const result = await db.collection('posts').insertMany(postsCollection);
    console.log(`${result.insertedCount} posts inserted.`);
  
    // Update with the generated post IDs
    for (const userID of userIDs) {
      await db.collection('users').updateOne({ _id: userID }, { $set: { posts: userPostsMap[userID] || [] } });
    }
  }
  
  async function generateUsersAndConversationsAndPosts() {
    const client = new MongoClient('mongodb://localhost:27017', { useNewUrlParser: true, useUnifiedTopology: true });
  
    try {
      await client.connect();
      const db = client.db('social-network-faker');
  
      const userPostsMap = await generateUsers(client, db);
      await generateConversations(client, db);
      await generatePosts(client, db, userPostsMap);
    } finally {
      await client.close();
    }
  }
  
  generateUsersAndConversationsAndPosts();