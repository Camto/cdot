"use strict";

let lex = require("./lex");
let parse = require("./parse");
let run = require("./run");

function cdot(prog) {
	let tokens = lex(prog);
	//console.log(tokens);
	let ast = parse(tokens);
	//console.log(JSON.stringify(ast, null, "\t"));
	return run(ast);
}

let p = process.argv[2];

console.log(JSON.stringify(cdot(p), null, "\t"));