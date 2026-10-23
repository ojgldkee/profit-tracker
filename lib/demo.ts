export const demoDashboard = {
  mode:"demo",
  store:{name:"Demo Store",currency:"USD"},
  period:"Last 7 days",
  summary:{
    grossSales:12842.18,
    netRevenue:11931.44,
    orders:214,
    adSpend:3564.21,
    cogs:2138.84,
    fulfillment:986.35,
    paymentFees:421.19,
    refunds:319.00,
    variableExpenses:126.00,
    contributionProfit:4368.85,
    contributionMargin:0.3662,
    blendedRoas:3.35,
    metaRoas:3.71,
    breakEvenRoas:1.62,
    aov:55.75,
    cpa:16.65,
    profitPerOrder:20.42
  },
  daily:[
    {date:"Mon",revenue:1430,profit:422,spend:390},
    {date:"Tue",revenue:1680,profit:511,spend:466},
    {date:"Wed",revenue:1594,profit:438,spend:492},
    {date:"Thu",revenue:1911,profit:720,spend:471},
    {date:"Fri",revenue:2150,profit:840,spend:589},
    {date:"Sat",revenue:1815,profit:654,spend:578},
    {date:"Sun",revenue:1351,profit:784,spend:578}
  ],
  ads:[
    {name:"UGC — Morning Routine",spend:841.21,revenue:3234.12,orders:57,metaRoas:4.02,profit:1184.28,margin:0.366,status:"scale"},
    {name:"Static — 3 Bottles",spend:619.74,revenue:2012.88,orders:38,metaRoas:3.48,profit:603.41,margin:0.300,status:"scale"},
    {name:"Founder Story",spend:731.40,revenue:2208.20,orders:41,metaRoas:3.05,profit:445.18,margin:0.202,status:"hold"},
    {name:"Problem / Solution V2",spend:882.33,revenue:1974.04,orders:36,metaRoas:2.21,profit:81.32,margin:0.041,status:"watch"},
    {name:"Old Static",spend:489.53,revenue:846.20,orders:15,metaRoas:1.69,profit:-145.34,margin:-0.172,status:"kill"}
  ],
  products:[
    {name:"Aged Garlic + CoQ10",revenue:8142.43,orders:143,cogs:1001.00,profit:3042.21,margin:0.374,breakEvenCpa:29.88,breakEvenRoas:1.47},
    {name:"Pure Moringa",revenue:3789.01,orders:71,cogs:1137.84,profit:1326.64,margin:0.350,breakEvenCpa:24.10,breakEvenRoas:1.73}
  ],
  orders:[
    {name:"#1088",date:"Today 11:42 AM",revenue:64.99,cogs:7.80,shipping:4.95,fees:2.19,adCost:18.61,profit:31.44},
    {name:"#1087",date:"Today 10:18 AM",revenue:49.99,cogs:6.99,shipping:4.95,fees:1.75,adCost:16.92,profit:19.38},
    {name:"#1086",date:"Today 9:51 AM",revenue:89.98,cogs:13.98,shipping:6.21,fees:2.94,adCost:21.10,profit:45.75}
  ],
  alerts:[
    {type:"positive",title:"Morning Routine is your highest-profit creative",body:"$1,184 contribution profit over the selected period. CPA remains 31% below break-even."},
    {type:"warning",title:"Problem / Solution V2 is close to break-even",body:"ROAS still looks acceptable, but true contribution margin is only 4.1% after COGS and fees."},
    {type:"negative",title:"Old Static is losing money",body:"It generated $846 in revenue but lost $145 after product, fulfillment, payment and ad costs."}
  ]
};
