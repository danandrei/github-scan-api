// Dependencies
const express = require('express');
const http = require('http');
const octokit = require('@octokit/rest')();
const _ = require('lodash');

const HOUR = 1000 * 60 * 60;

// authenticate
const username = 'USERNAME';
const password = 'PASSWORD';
octokit.authenticate({
  type: 'basic',
  username,
  password,
});

async function getUserEvents (username) {
  let response = await octokit.activity.getEventsForUser({username, per_page: 100});
  let {data} = response;
  while (octokit.hasNextPage(response)) {
    response = await octokit.getNextPage(response);
    data = data.concat(response.data);
  }
  return data;
}

function buildCodingSessions (events) {
  const sessions = [];

  const dates = events.map(event => new Date(event.created_at)).sort((a, b) => {
    return a - b;
  });

  dates.forEach(date => {

    // create the first session
    if (!sessions.length) {
      sessions.push({
        from: new Date(date - 3 * HOUR),
        actions: 1,
        to: date,
      });
      return;
    }

    const lastSession = sessions[sessions.length - 1];
    const diffInMinutes = (date - lastSession.to) / 1000 / 60;

    if (diffInMinutes < 2 * 60) {
      lastSession.to = date;
      lastSession.actions += 1;
    } else {
      sessions.push({
        from: new Date(date - 3 * HOUR),
        actions: 1,
        to: date,
      });
    }
  });

  return sessions;
}

function sessionsToHours (sessions) {
  const hours = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  sessions.forEach(session => {
    const fromHour = session.from.getHours();
    const toHour = session.to.getHours();

    for (let hour = fromHour; hour <= toHour; ++ hour) {
      hours[hour] += 1;
    }
  });

  const max = hours.reduce((prev, current) => {
    return (prev > current) ? prev : current;
  });

  return {max, hours};
}

function sessionsToDays (sessions) {
  const days = [0, 0, 0, 0, 0, 0, 0];

  sessions.forEach(session => {
    const day = session.from.getDay();
    days[day] += 1;
  });

  const max = days.reduce((prev, current) => {
    return (prev > current) ? prev : current;
  });

  return {max, days};
}

// setup http SERVER
const app = express();
const server = http.createServer(app);

app.get('/statistics', async (req, res, next) => {

  let events;
  try {
    events = await getUserEvents('danandrei');
  } catch (error) {
    return next(console.error())
  }

  const codingSessions = buildCodingSessions(events);
  const hourStatistics = sessionsToHours(codingSessions);
  const dayStatistics = sessionsToDays(codingSessions);

  res.json({codingSessions, hourStatistics, dayStatistics});
});

app.use((err, req, res, _next) => {
    return res.status(400).json({ message: err.message });
});

server.listen(9999, () => {
  console.log('server started');
})
