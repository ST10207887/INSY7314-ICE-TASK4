// Integration tests: real Express app + in-memory MongoDB; Cloudinary is mocked.
// Run with: npm test   (uses the built-in Node.js test runner)
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.JWT_SECRET = 'test-secret';
process.env.AUTH_RATE_LIMIT = '1000';

// ---- mock util/cloudinary before the app loads it
const calls = { deleted: [] };
let n = 0;
const cloudPath = path.join(__dirname, '..', 'util', 'cloudinary.js');
require.cache[cloudPath] = {
  id: cloudPath, filename: cloudPath, loaded: true,
  exports: {
    uploadImage: async () => { n += 1; return { secure_url: `https://res.cloudinary.com/demo/image/upload/photo${n}.jpg`, public_id: `photostore/photo${n}` }; },
    deleteImage: async (id) => { calls.deleted.push(id); return { result: 'ok' }; },
  },
};

// ---- tiny expect() helper on top of node:assert (keeps the tests readable)
function subset(actual, expected) {
  for (const [k, v] of Object.entries(expected)) {
    if (v && typeof v === 'object') subset(actual?.[k], v);
    else assert.equal(actual?.[k], v, `property "${k}"`);
  }
}
function expect(actual) {
  return {
    toBe: (e) => assert.equal(actual, e),
    toBeTruthy: () => assert.ok(actual),
    toBeUndefined: () => assert.equal(actual, undefined),
    toBeGreaterThan: (e) => assert.ok(actual > e, `${actual} > ${e}`),
    toHaveLength: (e) => assert.equal(actual.length, e),
    toMatch: (re) => assert.match(actual, re),
    toMatchObject: (e) => subset(actual, e),
    not: { toBe: (e) => assert.notEqual(actual, e) },
  };
}

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
let mongo, userToken, user2Token, adminToken, userId, user2Id, adminId, photoId;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('auth', () => {
  test('signup returns 201, a JWT and the user without password', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send({ username: 'Sam', email: 'SAM@Example.com', password: 'Password123', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('sam@example.com');
    expect(res.body.user.role).toBe('user'); // role in body is ignored
    expect(res.body.user.password).toBeUndefined();
    userToken = res.body.token; userId = res.body.user._id;
    const stored = await User.findById(userId).select('+password');
    expect(stored.password).not.toBe('Password123');
  });

  test('signup validation and duplicate email', async () => {
    expect((await request(app).post('/api/auth/signup').send({ email: 'bad' })).status).toBe(400);
    expect((await request(app).post('/api/auth/signup')
      .send({ username: 'Sam2', email: 'sam@example.com', password: 'Password123' })).status).toBe(409);
  });

  test('login returns JWT with id, role and expiry', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'sam@example.com', password: 'Password123' });
    expect(res.status).toBe(200);
    const payload = JSON.parse(Buffer.from(res.body.token.split('.')[1], 'base64url').toString());
    expect(payload).toMatchObject({ id: userId, role: 'user' });
    expect(payload.exp).toBeGreaterThan(payload.iat);
    expect((await request(app).post('/api/auth/login').send({ email: 'sam@example.com', password: 'wrong' })).status).toBe(401);
  });

  test('second user and admin', async () => {
    const r2 = await request(app).post('/api/auth/signup').send({ username: 'Lee', email: 'lee@example.com', password: 'Password123' });
    user2Token = r2.body.token; user2Id = r2.body.user._id;
    await User.create({ username: 'Admin', email: 'admin@example.com', password: 'Admin12345', role: 'admin' });
    const ra = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'Admin12345' });
    adminToken = ra.body.token; adminId = ra.body.user._id;
    expect(ra.body.user.role).toBe('admin');
  });
});

describe('profile', () => {
  test('requires a token', async () => {
    expect((await request(app).get('/api/users/me')).status).toBe(401);
    expect((await request(app).get('/api/users/me').set(auth('garbage'))).status).toBe(401);
  });
  test('get and update me', async () => {
    const me = await request(app).get('/api/users/me').set(auth(userToken));
    expect(me.status).toBe(200);
    expect(me.body.username).toBe('Sam');
    const up = await request(app).put('/api/users/me').set(auth(userToken)).send({ username: 'Samuel', email: 'Samuel@Example.com', role: 'admin' });
    expect(up.status).toBe(200);
    expect(up.body).toMatchObject({ username: 'Samuel', email: 'samuel@example.com', role: 'user' });
    expect((await request(app).put('/api/users/me').set(auth(userToken)).send({ email: 'lee@example.com' })).status).toBe(409);
  });
});

describe('admin', () => {
  test('non-admin gets 403', async () => {
    expect((await request(app).get('/api/users').set(auth(userToken))).status).toBe(403);
  });
  test('list, promote, demote', async () => {
    const list = await request(app).get('/api/users').set(auth(adminToken));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(3);
    expect(list.body[0].password).toBeUndefined();
    const p = await request(app).put(`/api/users/${user2Id}/promote`).set(auth(adminToken));
    expect(p.body.role).toBe('admin');
    const d = await request(app).put(`/api/users/${user2Id}/demote`).set(auth(adminToken));
    expect(d.body.role).toBe('user');
    expect((await request(app).put(`/api/users/${adminId}/demote`).set(auth(adminToken))).status).toBe(400);
    expect((await request(app).put('/api/users/abc/promote').set(auth(adminToken))).status).toBe(400);
    expect((await request(app).put(`/api/users/${new mongoose.Types.ObjectId()}/promote`).set(auth(adminToken))).status).toBe(404);
  });
});

describe('photos', () => {
  test('upload requires image and title', async () => {
    expect((await request(app).post('/api/photos').set(auth(userToken)).field('title', 'x')).status).toBe(400);
    expect((await request(app).post('/api/photos').set(auth(userToken))
      .attach('image', PNG, { filename: 'a.png', contentType: 'image/png' })).status).toBe(400);
    expect((await request(app).post('/api/photos').set(auth(userToken)).field('title', 'x')
      .attach('image', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' })).status).toBe(400);
  });

  test('upload a photo', async () => {
    const res = await request(app).post('/api/photos').set(auth(userToken))
      .field('title', 'Mountain View').field('description', 'A photograph taken during a hike.')
      .attach('image', PNG, { filename: 'm.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Mountain View', cloudinaryPublicId: 'photostore/photo1' });
    expect(res.body.imageUrl).toMatch(/^https:/);
    expect(res.body.owner).toMatchObject({ _id: userId, username: 'Samuel' });
    photoId = res.body._id;
  });

  test('gallery shows own photos; /all is admin only', async () => {
    expect((await request(app).get('/api/photos').set(auth(userToken))).body).toHaveLength(1);
    expect((await request(app).get('/api/photos').set(auth(user2Token))).body).toHaveLength(0);
    expect((await request(app).get('/api/photos/all').set(auth(userToken))).status).toBe(403);
    expect((await request(app).get('/api/photos/all').set(auth(adminToken))).body).toHaveLength(1);
  });

  test('only the owner can update; new image replaces and deletes the old asset', async () => {
    expect((await request(app).put(`/api/photos/${photoId}`).set(auth(user2Token)).send({ title: 'hack' })).status).toBe(403);
    const t = await request(app).put(`/api/photos/${photoId}`).set(auth(userToken)).send({ title: 'New title' });
    expect(t.status).toBe(200);
    expect(t.body.title).toBe('New title');
    const img = await request(app).put(`/api/photos/${photoId}`).set(auth(userToken))
      .attach('image', PNG, { filename: 'n.png', contentType: 'image/png' });
    expect(img.status).toBe(200);
    expect(img.body.cloudinaryPublicId).toBe('photostore/photo2');
    assert.ok(calls.deleted.includes('photostore/photo1'));
  });

  test('delete: not other users, yes owner/admin', async () => {
    expect((await request(app).delete(`/api/photos/${photoId}`).set(auth(user2Token))).status).toBe(403);
    const del = await request(app).delete(`/api/photos/${photoId}`).set(auth(adminToken));
    expect(del.status).toBe(200);
    assert.ok(calls.deleted.includes('photostore/photo2'));
    expect((await request(app).delete(`/api/photos/${photoId}`).set(auth(userToken))).status).toBe(404);
  });

  test('deleting a user removes their photos', async () => {
    await request(app).post('/api/photos').set(auth(user2Token)).field('title', 'Lee pic')
      .attach('image', PNG, { filename: 'l.png', contentType: 'image/png' });
    const res = await request(app).delete(`/api/users/${user2Id}`).set(auth(adminToken));
    expect(res.body).toMatchObject({ deletedPhotos: 1 });
    expect((await request(app).get('/api/users/me').set(auth(user2Token))).status).toBe(401);
  });
});

test('unknown route returns 404 JSON', async () => {
  const res = await request(app).get('/api/nope');
  expect(res.status).toBe(404);
  expect(res.body.message).toMatch(/Route not found/);
});
