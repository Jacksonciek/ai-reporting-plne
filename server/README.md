# Running container redis

<!-- docker run -d -p 6379:6379 --name redis-server redis -->

docker run -d --name redis-container -v /home/ec2-user/redis.conf:/usr/local/etc/redis/redis.conf -p 6379:6379 redis redis-server /usr/local/etc/redis/redis.conf

# Running Container Apps

docker build -t flask-app .

docker run -d -p 5000:5000 --env-file .env flask-app

# running database

flask db upgrade
