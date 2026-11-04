// Input-only route plans for the authored expansion; no runtime position changes.
export type RoutePoint={x:number;y:number;climb?:boolean;lift?:number;ride?:boolean;spring?:boolean};
export const expansionRoutes:Record<number,RoutePoint[]>={
41:[{x:220,y:450},{x:220,y:290,climb:true},{x:440,y:290},{x:440,y:130,climb:true},{x:880,y:130}],
42:[{x:385,y:450,lift:0},{x:385,y:210,lift:0,ride:true},{x:600,y:210},{x:900,y:210}],
43:[{x:160,y:450},{x:295,y:380},{x:460,y:310},{x:620,y:240},{x:800,y:170},{x:900,y:170}],
44:[{x:250,y:450,spring:true},{x:500,y:240},{x:570,y:240},{x:750,y:160},{x:900,y:160}],
45:[{x:835,y:450},{x:835,y:190,climb:true},{x:900,y:190}],
46:[{x:315,y:450,lift:0},{x:735,y:450,lift:0,ride:true},{x:850,y:450},{x:900,y:450}],
47:[{x:900,y:450}],
48:[{x:260,y:450},{x:260,y:250,climb:true},{x:500,y:250},{x:650,y:450},{x:900,y:450}],
49:[{x:240,y:900},{x:240,y:660,climb:true},{x:550,y:660},{x:550,y:420,climb:true},{x:610,y:420},{x:610,y:180,climb:true},{x:320,y:180}],
50:[{x:835,y:450},{x:835,y:190,climb:true},{x:900,y:190}],
51:[{x:310,y:450,lift:0},{x:310,y:300,lift:0,ride:true},{x:480,y:300},{x:660,y:300,lift:1},{x:660,y:140,lift:1,ride:true},{x:850,y:140},{x:900,y:140}],
52:[{x:380,y:450},{x:380,y:270,climb:true},{x:620,y:270},{x:700,y:450},{x:900,y:450}],
53:[{x:280,y:860},{x:280,y:650,climb:true},{x:800,y:650},{x:700,y:650},{x:700,y:440,climb:true},{x:220,y:440},{x:220,y:230,climb:true},{x:880,y:230}],
54:[{x:250,y:450,spring:true},{x:480,y:240},{x:550,y:240,spring:true},{x:800,y:70},{x:900,y:70}],
55:[{x:835,y:450},{x:835,y:190,climb:true},{x:900,y:190}],
56:[{x:315,y:450,lift:0},{x:735,y:270,lift:0,ride:true},{x:850,y:270},{x:900,y:270}],
57:[{x:170,y:450},{x:330,y:380},{x:540,y:310},{x:760,y:240},{x:900,y:240}],
58:[{x:260,y:450},{x:260,y:250,climb:true},{x:450,y:250},{x:590,y:250,lift:0},{x:730,y:250,lift:0,ride:true},{x:850,y:250},{x:900,y:250}],
59:[{x:260,y:1000},{x:260,y:760,climb:true},{x:550,y:760},{x:550,y:520,climb:true},{x:850,y:520},{x:620,y:520},{x:620,y:280,climb:true},{x:300,y:280}],
60:[{x:835,y:450},{x:835,y:190,climb:true},{x:900,y:190}]
};
