"use strict";

let lex = require("./lex");
let parse = require("./parse");
let run = require("./run");

function cdot(prog) {
	let tokens = lex(prog);
	//console.log(tokens);
	let ast = parse(tokens);
	return run(ast);
}

let p = `1p2`;

console.log(JSON.stringify(cdot(p), null, "\t"));