const axios = require("axios");
require("dotenv").config();
var daemon = require("daemonize2").setup({
    main: "index.js",
    name: "bot-freelance",
    pidfile: "botfreelance.pid"
});

axios.defaults.headers.common["Authorization"] = "Bearer " + process.env.TOKEN;

const getProject = async () => {
  const list = await axios.get(
    "https://api.freelancehunt.com/v2/projects?filter[only_my_skills]=1"
  );
  const data = await list.data.data;
  let items = [];
  await data.map((item) => {
    let info;
    if (item.attributes.employer) {
      info = {
        name: item.attributes.name,
        skills: item.attributes.skills,
        budget_project: item.attributes.budget,
        published_at: item.attributes.published_at,
        first_name: item.attributes.employer.first_name,
        link_bids: item.links.bids,
      };
    } else {
      info = {
        name: item.attributes.name,
        skills: item.attributes.skills,
        budget_project: item.attributes.budget,
        published_at: item.attributes.published_at,
        first_name: "",
        link_bids: item.links.bids,
      };
    }

    items.push(info);
  });
  return items;
};

const getBids = async (projects) => {
  let items = [];
  for (let project of projects) {
    let bidsInfo = [];
    const bids = await axios.get(project.link_bids);
    const data = await bids.data.data;
    await data.map((bid) => {
      if (!bid.attributes.is_hidden) {
        const info = {
          days: bid.attributes.days,
          budget: bid.attributes.budget,
        };
        bidsInfo.push(info);
      }
    });
    const infoProject = {
      ...project,
      bids: bidsInfo,
    };
    bidsInfo = [];
    items.push(infoProject);
  }
  return items;
};

const analysis = async (items) => {
  let list = [];
  let days;
  for (let item of items) {
    let budget;
    let currency;
    if (item.budget_project !== null) {
      budget = item.budget_project.amount;
      currency = item.budget_project.currency;
    } else {
      let summa;
      let daysBids;
      let count = 1;
      for (const bid of item.bids) {
        summa += bid.budget.amount;
        daysBids += bid.days;
        count++;
      }
      budget = Math.floor(summa / count);
      days = Math.floor(daysBids / count);
    }
    const info = {
      currency: currency,
      budget: budget,
      days: days,
      first_name: item.first_name,
      link_bids: item.link_bids,
    };
    list.push(info);
  }
  return list;
};

const postBid = async (items) => {
  for (let item of items) {
    let currency;
    let days;
    let budget;
    if (item.currency) {
      currency = item.currency;
    } else {
      currency = "RUB"; //UAH
    }
    if (item.days === 0 || !item.days) {
      days = 2;
    } else {
      days = item.days;
    }
    if (item.budget === 0 || !item.budget) {
      budget = 1500;
    } else {
      budget = item.budget;
    }
    const content = {
      days: days,
      budget: {
        amount: budget,
        currency: currency,
      },
      safe_type: "employer",
      comment: `Здравствуйте, ${item.first_name}.
    Сделаю все быстро и качественно.
    Многолетний опыт в веб-дизайне и веб-разработке.
    Мое портфолио: https://www.behance.net/urijhoruzij
    Буду рад сделать для Вас этоn проект.`,
      is_hidden: false,
    };
    axios.post(item.link_bids, content);
  }
};

const bot = async () => {
  try {
    const projects = await getProject();
    const bids = await getBids(projects);
    const items = await analysis(bids);
    await postBid(items);
  } catch (error) {
    console.error(error);
  }
};

daemon.start();
bot();
setInterval(()=>bot(),1000*60*60);