"use strict";

let keywords = [
	"fn", "store", "args",
	"if", "elif", "else",
	"for", "while", "repeat",
	// Operator equivalents
	"p", "m", "n", "t", "d", "e", "mod", "div",
	"to", "at",
	"eq", "ne", "lt", "gt", "le", "ge",
	"and", "or", "not",
	"is", "set"
];

let op_keywords = {
	p: "+", m: "-", n: "~", t: "*", d: "/", e: "^", mod: "%", div: "%%",
	to: "..", at: "@",
	eq: "==", ne: "!=", lt: "<", gt: ">", le: "<=", ge: ">=",
	and: "&", or: "|", not: "!",
	is: "=", set: "<-"
};

let long_ops = ["<-", "%%", "..", "<=", ">=", "==", "!="];

function lex(prog) {
	let i = 0;
	let tokens = [];
	
	while(i < prog.length) {
		if(/[A-Za-z_]/.test(prog[i]))
			tokens.push(expect_sym());
		else if(/\d/.test(prog[i]))
			tokens.push(expect_num());
		else if(['"', "'"].includes(prog[i]))
			tokens.push(expect_str());
		else if(",.=()[]{}<>$^*/%+@!&|~".split("").includes(prog[i]))
			tokens.push(expect_op());
		else if(prog[i] == "?")
			tokens.push(expect_q());
		else
			i++;
	}
	
	return tokens;
	
	function expect_sym() {
		let end = i + 1;
		
		while(/[A-Za-z_]/.test(prog[end]) && end < prog.length)
			end++;
		
		let sym = prog.substring(i, end).replaceAll("_", "").toLowerCase();
		i = end;
		
		if(/^q+$/.test(sym))
			return {type: "?", n: sym.length};
		else if(keywords.includes(sym)) {
			if(op_keywords[sym])
				return {type: op_keywords[sym]};
			else
				return {type: sym};
		} else
			return {type: "name", data: sym};
	}
	
	function expect_num() {
		let end = i + 1;
		
		while(/\d/.test(prog[end]) && end < prog.length)
			end++;
		
		if(prog[end] == "." && /\d/.test(prog[end + 1])) {
			end++;
			while(/\d/.test(prog[end]) && end < prog.length)
				end++;
		}
		
		let num = prog.substring(i, end);
		i = end;
		
		return {type: "num", data: parseFloat(num)};
	}
	
	function expect_str() {
		let quote = prog[i];
		i++;
		
		let str = "";
		let escaped = false;
		while((prog[i] != quote || escaped) && i < prog.length) {
			if(!escaped) {
				if(prog[i] != "\\")
					str += prog[i];
				else
					escaped = true;
			} else {
				escaped = false;
				switch(prog[i]) {
					case "n":
						str += "\n";
						break;
					case "t":
						str += "\t";
						break;
					default:
						str += prog[i];
						break;
				}
			}
			i++;
		}
		
		if(prog[i] != quote)
			throw `Error: found ${quote} to start a string, but none to finish it.`;
		
		i++;
		
		return {type: "str", data: str};
	}
	
	function expect_op() {
		if(
				i < prog.length - 1 &&
				long_ops.includes(prog.substring(i, i + 2))) {
			i += 2;
			return {type: prog.substring(i - 2, i)};
		} else {
			i++;
			return {type: prog[i - 1]};
		}
	}
	
	function expect_q() {
		let n = 1;
		while(prog[++i] == "?") n++;
		return {type: "?", n};
	}
}

module.exports = lex;