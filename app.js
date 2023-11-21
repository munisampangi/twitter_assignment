const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbpath = path.join(__dirname, 'twitterClone.db')
let db = null

const intializeDBandServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server running')
    })
  } catch (e) {
    console.log(`dbError:${e.message}`)
  }
}

intializeDBandServer()

app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const getquery = `select * from user where username="${username}";`
  const list = await db.get(getquery)

  if (list === undefined) {
    const hashedpassword = await bcrypt.hash(password, 10)
    const createquery = `insert into user (name,username,password,gender) values(
        "${name}","${username}","${hashedpassword}","${gender}");`

    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      await db.run(createquery)

      response.status(200)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

// login api
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const getquery = `select * from user where username="${username}";`
  const list = await db.get(getquery)

  if (list === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const passwordcheck = await bcrypt.compare(password, list.password)
    if (passwordcheck === true) {
      const payload = {username: username}
      const jwttoken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwttoken:jwttoken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// middileware
const logger = (request, response, next) => {
  let accesstoken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    accesstoken = authHeader.split(' ')[1]
  }
  if (jwttoken !== undefined) {
    jwt.verify(accesstoken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  } else {
    response.status(401)
    response.send('Invalid JWT Token')
  }
}

app.get('/user/tweets/feed/', logger, async (request, response) => {
  const {username} = request.username
  const getuserid = `select user_id from user where usernmae=${username};`
  const getid = await db.get(getuserid)
  const followerid = `select follower_user_id from follower where follower_user_id=${getid.user_id};`
  const getfollowerid = await db.all(followerid)
  const getfollowerlist = getfollowerid.map(each => {
    return each.follower_user_id
  })

  const getfullquery = `select user.username,tweet.tweet,tweet.date_time as dateTime from user inner join tweet on user.user_id=tweet.user_id
where user.user_id in (${getfollowerid}) order by tweet.date_time desc limit 4;`

  const responseresult = await db.all(getfullquery)
  response.send(responseresult)
})

module.exports = app
