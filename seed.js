import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker/locale/fr";
import  {randomUUID} from 'crypto'
import fs from 'fs/promises'

const prisma = new PrismaClient();

function createUsers(n) {
  const users = [];
  for (var i = 0; i < n; i++) {
    users.push({
      email: faker.internet.email(),
      password: faker.internet.password(),
      name: faker.internet.userName(),
      role: faker.helpers.arrayElement(["guest", "admin", "author"]),
      active: Math.random() > 0.3 ? true : false,
    });
  }
  return prisma.user.createMany({ data: users });
}

function createPosts(n) {
  const posts = [];
  for (var i = 0; i < n; i++) {
    const createdAt = faker.date.between({ from: '2020-01-01T00:00:00.000Z', to: '2024-05-01T00:00:00.000Z' })
    posts.push({
      title: faker.lorem.words({ min: 1, max: 3 }),
      body: faker.lorem.paragraphs({ min: 0, max: 5 }),
      published: Math.random() > 0.1 ? true : false,
      likes: faker.number.int({min: 0, max: 20000}),
      createdAt,
      updatedAt:createdAt
    });
  }
  return prisma.post.createMany({ data: posts });
}
function createCategories(n) {
  const cats = [];
  for (var i = 0; i < n; i++) {
    cats.push({
      name: faker.lorem.words({ min: 1, max: 2 }),
    });
  }
  return prisma.category.createMany({ data: cats, skipDuplicates: true });
}

function createTags(n) {
  const tags = [];
  for (var i = 0; i < n; i++) {
    tags.push({
      name: faker.lorem.word({ length: { min: 2, max: 5 } }),
    });
  }
  return prisma.tag.createMany({ data: tags, skipDuplicates: true });
}

async function getRemoteImage(id) {
  const url = "https://picsum.photos/600/350?" + id
  const filename = randomUUID() + '.jpeg'
  const path = process.cwd() + '/public/images/' + filename
  const ab = await fetch(url).then(res => res.arrayBuffer())
  await fs.writeFile(path,  Buffer.from(ab))
  await prisma.post.update({where : {id}, data: {image: filename}})
  await new Promise(r => setTimeout(r, 20))
  return filename
}

async function clear() {
  await prisma.user.deleteMany();
  await prisma.post.deleteMany();
  await prisma.category.deleteMany();
  await prisma.tag.deleteMany();
}

async function seed() {
  const path = process.cwd() + '/public/images/'
  await clear();
  await createUsers(20);
  await createPosts(300);
  await createTags(30);
  await createCategories(10);
  const images = await fs.readdir(path)
  await Promise.all(images.map(img =>  fs.rm(path + img)))

  const users = await prisma.user.findMany();
  const userIds = users.filter(u => u.active && !(u.role === 'guest')).map((u) => u.id);
  const tags = await prisma.tag.findMany();
  const tagsIds = tags.map((t) => ({ id: t.id }));
  const cats = await prisma.category.findMany();
  const catIds = cats.map((c) => c.id);
  const posts = await prisma.post.findMany();
  return Promise.all(posts.map(async (p) => {
    let filename = null
    try {
      filename = await getRemoteImage(p.id)
    } catch (error) {
      console.log(error.message)
    }
    const fuserId = faker.helpers.arrayElement(userIds)
    const fcatId = faker.helpers.arrayElement(catIds)
    const ftagIds = faker.helpers.arrayElements(tagsIds, { min: 0, max: 5 })
    // console.log(fuserId, fcatId, ftagIds)
    await prisma.post.update({
      where: { id: p.id },
      include: { author: true, tags: true, category: true },
      data: {
        image: filename,
        author: { connect: { id: fuserId } },
        category: { connect: { id: fcatId } },
        tags: {
          connect: ftagIds,
        },
      },
    });
  }));
}

seed().then(console.log("Done")).catch(er => console.log(er.message));
