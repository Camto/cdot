"use strict";

let lex = require("./lex");
let parse = require("./parse");

let tokens = lex("fn fact .1..?, prod., map $fact 1..10");
//console.log(tokens);
console.log(JSON.stringify(parse(tokens)));