"use strict";

Array.prototype.map_maybe = function(fn) {
	return this.map(fn).filter(i => i != null);
}

let bin_op_table = [
	["^"],
	["*", "/", "%", "%%"],
	["+", "-"],
	["..", "@"],
	["<", ">", "<=", ">="],
	["==", "!="],
	["&", "|"]
];

let un_ops = ["~", "!"];

let built_in_funcs = ["ls", "sqrt", "map", "prod", "print", "sum", "pop", "push", "void", "len"];

let built_in_vars = ["true", "false"];

let ops = bin_op_table.flat().concat(un_ops);

let is_op = token => ops.includes(token.type) && !token.left && !token.arg;

let find_prec = op =>
	bin_op_table.map_maybe((row, i) => row.includes(op.type) ? i : null);

let find_highest_prec_op = stuff =>
	stuff.reduce((highest, thing, i) => {
		if(is_op(thing) && find_prec(thing) < highest.prec)
			return {i, prec: find_prec(thing)};
		else
			return highest;
	}, {i: null, prec: bin_op_table.length}).i;

// For all keywords: if it's unexpected, see if it's spelt differently than default, chances are the user wanted a fn or var
// For same scope rebinding, check if name is spelt differently, chances are the user thought they would be different

function parse(tokens) {
	let bound = [[
		...built_in_vars.map(name => ({kind: "var", name})),
		...built_in_funcs.map(name => ({kind: "func", name}))
	]];
	
	let sets_qs_stack = [];
	
	let find_bound_named = name =>
		bound.map_maybe((scope, i) => {
			let found = scope.find(var_or_func => var_or_func.name == name);
			if(found) return {kind: found.kind, i: bound.length - 1 - i};
			else return null;
		})[0] ||
		(() => {throw `${name} ain't a name, bro`})();
	
	function done(in_semiparens, i = 0) {
		if(tokens.length <= i) return true;
		
		let first = tokens[i];
		return (
			[")", "]", "}", ","].includes(first.type) ||
			in_semiparens && first.type == ".");
	}
	
	function parse_rec(in_semiparens, inherit_q = false, new_scope = []) {
		bound.unshift(new_scope);
		
		let pipe_sections = [];
		while(
				!done(in_semiparens) ||
				tokens.length > 0 && tokens[0].type == ",") {
			
			pipe_sections.push(parse_pipe_section(in_semiparens, inherit_q));
			if(tokens.length > 0 && tokens[0].type == ",") tokens.shift();
			inherit_q = false;
		}
		
		bound.shift();
		
		return pipe_sections;
	}
	
	function parse_pipe_section(in_semiparens, inherit_q = false) {
		let first = tokens.shift();
		switch(first.type) {
			case "fn": return parse_fn(in_semiparens);
			
			case "store":
			case "args":
				return parse_store(in_semiparens);
			
			default:
				tokens.unshift(first);
				return parse_normal(in_semiparens, inherit_q);
		}
	}
	
	function parse_normal(in_semiparens, inherit_q) {
		let {vars, declared, i} = lookahead_vars(in_semiparens);
		let var_op;
		if(
				vars &&
				i < tokens.length &&
				["=", "<-"].includes(tokens[i].type)) {
			var_op = tokens[i].type;
			tokens.splice(0, i + 1);
			if(var_op == "=") {
				for(let new_vars of declared)
					if(bound[0].map(var_or_func => var_or_func.name).includes(new_vars.name))
						throw "already bound in this scope bruh";
				bound[0] = declared.concat(bound[0]);
			} else if( var_op == "<-") {
				if(!declared.every(({name}) => find_bound_named(name).kind == "var"))
					throw "<-ing a func";
				vars = vars.map(index_vars);
			}
		}
		
		// Consider making passing from pipe into tuples (func = "id") an error because that's weird functionality
		let func = "id";
		let scope_i = 0;
		if(
				tokens.length > 0 &&
				tokens[0].type == "name") {
			let bound_name = find_bound_named(tokens[0].data);
			if(bound_name.kind == "func") {
				func = tokens.shift().data;
				scope_i = bound_name.i;
			}
		}
		
		let args, sets_qs;
		if(inherit_q) {
			args = parse_args(in_semiparens);
			sets_qs = false;
		} else {
			sets_qs_stack.push(false);
			args = parse_args(in_semiparens);
			sets_qs = sets_qs_stack.pop();
		}
		
		if(!var_op)
			return {type: "call", func, i: scope_i, sets_qs, args};
		else
			return {type: var_op, vars, func, i: scope_i, sets_qs, args};
	}
	
	function parse_vars(in_semiparens) {
		let {vars, declared, i} = lookahead_vars(in_semiparens);
		tokens.splice(0, i);
		return {vars, declared};
	}
	
	function lookahead_vars(in_semiparens) {
		let i = 0;
		let declared = [];
		let vars;
		
		({vars, i} = lookahead_var_list());
		
		return {vars, declared, i};
		
		function lookahead_var_list() {
			let vars = [];
			for(; !done(in_semiparens, i); i++) {
				let token = tokens[i];
				if(token.type == "name") {
					if(["ls", "list"].includes(token.data)) {
						i++;
						let var_list;
						({vars: var_list, i} = lookahead_var_list());
						vars.push({type: "list", data: var_list});
						i--;
					} else if(token.data == "dict") {
						i++;
						let var_dict;
						({vars: var_dict, i} = lookahead_var_dict());
						vars.push({type: "dict", data: var_dict});
						i--;
					} else {
						vars.push({type: "var", data: token.data});
						declared.push({kind: "var", name: token.data});
					}
				} else if(token.type == "[") {
					i++;
					let var_list;
					({vars: var_list, i} = lookahead_var_list());
					if(
							!var_list ||
							i >= tokens.length ||
							tokens[i].type != "]")
						break;
					vars.push({type: "list", data: var_list});
				} else if(token.type == "{") {
					i++;
					let var_dict;
					({vars: var_dict, i} = lookahead_var_dict());
					if(
							!var_dict ||
							i >= tokens.length ||
							tokens[i].type != "}")
						break;
					vars.push({type: "dict", data: var_dict});
				} else {
					break;
				}
			}
			
			return {vars, i};
		}
		
		function lookahead_var_dict() {
			let vars = [];
			for(; !done(in_semiparens, i); i++) {
				let token = tokens[i];
				if(token.type == "name") {
					if(["ls", "list", "dict"].includes(token.data)) {
						break;
					} else {
						vars.push({type: "var", data: token.data});
						declared.push({kind: "var", name: token.data});
					}
				} else {
					break;
				}
			}
			
			return {vars, i};
		}
	}
	
	function parse_args(in_semiparens) {
		let args = [];
		while(!done(in_semiparens))
			args.push(parse_arg(in_semiparens));
		return args;
	}
	
	function parse_arg(in_semiparens) {
		let first_chunk = parse_chunk(in_semiparens);
		let arg = first_chunk ? [first_chunk] : [];
		while(
				!done(in_semiparens) &&
				is_op(tokens[0])) {
			arg.push(tokens.shift());
			if(
					!done(in_semiparens) &&
					!is_op(tokens[0]))
				arg.push(parse_chunk(in_semiparens));
			else if(
					done(in_semiparens) ||
					!un_ops.includes(tokens[0].type))
				break;
		}
		
		return parse_ops(arg);
	}
	
	function index_vars(vars) {
		if(vars.type == "var") {
			return {type: "var", data: vars.data, i: find_bound_named(vars.data).i}
		} else if(["list", "dict"].includes(vars.type)) {
			return {type: vars.type, data: vars.data.map(index_vars)};
		} else {
			throw "how?";
		}
	}
	
	function parse_chunk(in_semiparens) {
		let first = tokens.shift();
		
		switch(first.type) {
			case "num":
			case "str":
				return first;
			
			case "?":
				sets_qs_stack[sets_qs_stack.length - 1] = true;
				return first;
			
			case "name":
				let bound_name = find_bound_named(first.data);
				if(bound_name.kind == "var") {
					return {type: "var", name: first.data, i: bound_name.i};
				} else {
					return {
						type: "call",
						func: first.data,
						i: bound_name.i,
						arg: parse_args(in_semiparens)
					};
				}
			
			case "$":
				if(tokens.length > 0) {
					let token = tokens.shift();
					if(token.type != "name") throw "$ in front of non-name";
					let bound_name = find_bound_named(token.data);
					if(bound_name.kind == "var")
						return {type: "ref", name: token.data, i: bound_name.i};
					else
						return {type: "funcref", name: token.data, i: bound_name.i};
				} else {
					throw "$ with no token after";
				}
				
			case "(": {
				let is_func = tokens.length > 0 && tokens[0].type == ",";
				if(is_func)
					tokens.shift();
				
				let parse = parse_rec(false, true);
				
				if(tokens.length > 0 && tokens[0].type == ")")
					tokens.shift();
				else
					throw "terminated ( with wrong thing";
				
				return {type: !is_func ? "expr" : "anonfunc", data: parse};
			}
			case "[": {
				let parse = parse_rec(false, true);
				
				if(tokens.length > 0 && tokens[0].type == "]")
					tokens.shift();
				else
					throw "terminated [ with wrong thing";
				
				return {type: "list", data: parse};
			}
			case "{": {
				let parse = parse_rec(false, true);
				
				if(tokens.length > 0 && tokens[0].type == "}")
					tokens.shift();
				else
					throw "terminated { with wrong thing";
				
				return {type: "dict", data: parse};
			}
			case ".": {
				if(in_semiparens) throw "how?";
				
				let is_func = tokens.length > 0 && tokens[0].type == ",";
				if(is_func)
					tokens.shift();
				
				let parse = parse_rec(true, true);
				
				if(tokens.length > 0 && tokens[0].type == ".")
					tokens.shift();
				else
					throw "terminated . with wrong thing";
				
				return {type: !is_func ? "expr" : "anonfunc", data: parse};
			}
			case ")": throw "unexpected )";
			case "]": throw "unexpected ]";
			case "}": throw "unexpected }";
			
			case "if": return parse_if(in_semiparens);
			case "for": return parse_for(in_semiparens);
			case "while": return parse_while(in_semiparens);
			case "repeat": return parse_repeat(in_semiparens);
			
			case "else": throw "Else with no if? :flushed:";
			case "elif": throw "Elif with no if? :flushed:";
			
			default:
				tokens.unshift(first);
				return;
		}
	}
	
	function parse_ops(arg) {
		if(arg.length == 1) {
			if(!is_op(arg[0]))
				return arg[0];
			else if(un_ops.includes(arg[0].type))
				return {type: arg[0].type, arg: "implicit"};
			else
				return {type: arg[0].type, left: "implicit", right: "implicit"};
		}
		
		for(let i = arg.length - 1; i >= 0; i--) {
			if(un_ops.includes(arg[i].type)) {
				if(i != arg.length - 1)
					arg.splice(
						i, 2,
						{type: arg[i].type, arg: arg[i + 1]}
					);
				else
					arg[i] = {type: arg[i].type, arg: "implicit"};
			}
		}
		
		let i_of_highest = find_highest_prec_op(arg);
		while(arg.length > 1) {
			if(i_of_highest > 0 && is_op(arg[i_of_highest - 1]))
				throw "implicit left argument in the middle of operators";
			if(i_of_highest < arg.length - 1 && is_op(arg[i_of_highest + 1]))
				throw "implicit right argument in the middle of operators";
			
			let start_splice = i_of_highest;
			let end_splice = 1;
			
			let left_arg;
			if(i_of_highest == 0) {
				left_arg = "implicit";
			} else {
				start_splice--;
				end_splice++;
				left_arg = arg[i_of_highest - 1];
			}
			
			let right_arg;
			if(i_of_highest == arg.length - 1) {
				right_arg = "implicit";
			} else {
				end_splice++;
				right_arg = arg[i_of_highest + 1];
			}
			
			arg.splice(
				start_splice,
				end_splice,
				{type: arg[i_of_highest].type, left: left_arg, right: right_arg}
			);
			
			i_of_highest = find_highest_prec_op(arg);
		}
		
		
		return arg[0];
	}
	
	function parse_fn(in_semiparens) {
		if(tokens.length < 0 || tokens[0].type != "name")
			throw "fn got no name";
		
		let name = tokens.shift().data;
		if(bound[0].map(var_or_func => var_or_func.name).includes(name))
			throw "already bound in this scope bruh";
		bound[0].unshift({kind: "func", name: name});
		
		let {vars, declared} = parse_vars(in_semiparens);
		
		return {type: "func", name, args: vars, body: parse_block(in_semiparens, declared)};
	}
	
	function parse_store(in_semiparens) {
		let {vars, declared} = parse_vars(in_semiparens);
		for(let new_vars of declared)
			if(bound[0].map(var_or_func => var_or_func.name).includes(new_vars.name))
				throw "already bound in this scope bruh";
		bound[0] = declared.concat(bound[0]);
		if(!done(in_semiparens))
			throw "more stuff after store/args?";
		
		return {type: "=", vars, func: "id", i: 0, args: []};
	}
	
	function parse_if(in_semiparens) {
		let branches = [{
			cond: parse_block(in_semiparens, []),
			body: parse_block(in_semiparens, [])
		}];
		
		while(!done(in_semiparens) && tokens[0].type == "elif") {
			tokens.shift();
			branches.push({
				cond: parse_block(in_semiparens, []),
				body: parse_block(in_semiparens, [])
			});
		}
		
		if(!done(in_semiparens) && tokens[0].type == "else") {
			tokens.shift();
			branches.push({
				cond: null,
				body: parse_block(in_semiparens, [])
			});
		}
		
		return {type: "if", branches};
	}
	
	function parse_for(in_semiparens) {
		let {iter_vars, declared} = parse_vars(in_semiparens);
		let iterator = parse_block(in_semiparens, []);
		let body = parse_block(in_semiparens, declared);
		
		return {type: "for", iter_vars, iterator, body};
	}
	
	function parse_while(in_semiparens) {
		let cond = parse_block(in_semiparens, []);
		let body = parse_block(in_semiparens, []);
		
		return {type: "while", cond, body};
	}
	
	function parse_repeat(in_semiparens) {
		let times = parse_block(in_semiparens, []);
		let body = parse_block(in_semiparens, []);
		
		return {type: "repeat", times, body};
	}
	
	function parse_block(in_semiparens, declared) {
		if(
				done(in_semiparens) ||
				!["(", "."].includes(tokens[0].type))
			throw "no block bro";
		
		let open = tokens.shift().type;
		
		if(tokens.length > 0 && tokens[0].type == ",")
			throw "nuh uh block ain't use no lambda";
		
		let block;
		if(open == "(") {
			block = parse_rec(false, false, declared);
			
			if(tokens.length > 0 && tokens[0].type == ")")
				tokens.shift();
			else
				throw "terminated ( with wrong thing";
		} else if(open == ".") {
			if(in_semiparens) throw "how?";
			
			block = parse_rec(true, false, declared);
			
			if(tokens.length > 0 && tokens[0].type == ".")
				tokens.shift();
			else
				throw "terminated . with wrong thing";
		} else {
			throw "how?";
		}
		
		return block;
	}
	
	return parse_rec(false);
}

// fn fact .1..?, prod., map $fact 1..10
//tokens = [{type: "fn"}, {type: "name", data: "fact"}, {type: "."}, {type: "num", data: 1}, {type: ".."}, {type: "?"}, {type: ","}, {type: "name", data: "prod"}, {type: "."}, {type: ","}, {type: "name", data: "map"}, {type: "$"}, {type: "name", data: "fact"}, {type: "num", data: 1}, {type: ".."}, {type: "num", data: 10}];

// c q = sqrt 3^2 + 4^2
//tokens = [{type: "name", data: "c"}, {type: "name", data: "q"}, {type: "="}, {type: "name", data: "sqrt"}, {type: "num", data: 3}, {type: "^"}, {type: "num", data: 2}, {type: "+"}, {type: "num", data: 4}, {type: "^"}, {type: "num", data: 2}];

// 1+ +1
//tokens = [{type: "num"}, {type: "+"}, {type: "+"}, {type: "num"}];

// print sqrt 4
//tokens = [{type: "name", data: "print"}, {type: "name", data: "sqrt"}, {type: "num", data: 4}];

// .,args ls x y, x + y.
//tokens = [{type: "."}, {type: ","}, {type: "store"}, {type: "name", data: "ls"}, {type: "name", data: "x"}, {type: "name", data: "y"}, {type: ","}, {type: "name", data: "x"}, {type: "+"}, {type: "name", data: "y"}, {type: "."}];

// fn add [x y] .x + y., add ls 3 4
//tokens = [{type: "fn"}, {type: "name", data: "add"}, {type: "["}, {type: "name", data: "x"}, {type: "name", data: "y"}, {type: "]"}, {type: "."}, {type: "name", data: "x"}, {type: "+"}, {type: "name", data: "y"}, {type: "."}, {type: ","}, {type: "name", data: "add"}, {type: "name", data: "ls"}, {type: "num", data: 3}, {type: "num", data: 4}];

//tokens = [];

//tokens = [{type: ","}];

//tokens = [{type: "="}];

//tokens = [{type: "<-"}];

// a = 1, a <- 2
//tokens = [{type: "name", data: "a"}, {type: "="}, {type: "num", data: 1}, {type: ","}, {type: "name", data: "a"}, {type: "<-"}, {type: "num", data: 2}];

// ls a = ls 1, ls a <- ls 2
//tokens = [{type: "name", data: "ls"}, {type: "name", data: "a"}, {type: "="}, {type: "name", data: "ls"}, {type: "num", data: 1}, {type: ","}, {type: "name", data: "ls"}, {type: "name", data: "a"}, {type: "<-"}, {type: "name", data: "ls"}, {type: "num", data: 2}];

// fn a . ., a <- 1
//tokens = [{type: "fn"}, {type: "name", data: "a"}, {type: "."}, {type: "."}, {type: ","}, {type: "name", data: "a"}, {type: "<-"}, {type: "num", data: 1}];

// a <- 1
//tokens = [{type: "name", data: "a"}, {type: "<-"}, {type: "num", data: 1}];

// a b = 1 2
//tokens = [{type: "name", data: "a"}, {type: "name", data: "b"}, {type: "="}, {type: "num", data: 1}, {type: "num", data: 2}];

// a = 1, a = 2
//tokens = [{type: "name", data: "a"}, {type: "="}, {type: "num", data: 1}, {type: ","}, {type: "name", data: "a"}, {type: "="}, {type: "num", data: 2}];

// fn bruh a .a., bruh 5
//tokens = [{type: "fn"}, {type: "name", data: "bruh"}, {type: "name", data: "a"}, {type: "."}, {type: "name", data: "a"}, {type: "."}, {type: ","}, {type: "name", data: "bruh"}, {type: "num", data: 5}];

// fn bruh a .a., fn bruh a .a.
//tokens = [{type: "fn"}, {type: "name", data: "bruh"}, {type: "name", data: "a"}, {type: "."}, {type: "name", data: "a"}, {type: "."}, {type: ","}, {type: "fn"}, {type: "name", data: "bruh"}, {type: "name", data: "a"}, {type: "."}, {type: "name", data: "a"}, {type: "."}];

// 1..10, map .,1.., sum.
//tokens = [{type: "num", data: 1}, {type: ".."}, {type: "num", data: 10}, {type: ","}, {type: "name", data: "map"}, {type: "."}, {type: ","}, {type: "num", data: 1}, {type: ".."}, {type: ","}, {type: "name", data: "sum"}, {type: "."}];

// print if (true) .4. else .5.
//tokens = [{type: "name", data: "print"}, {type: "if"}, {type: "("}, {type: "name", data: "true"}, {type: ")"}, {type: "."}, {type: "num", data: 4}, {type: "."}, {type: "else"}, {type: "."}, {type: "num", data: 5}, {type: "."}];

// if .1.  ."a". elif .2.  ."b". elif .3.  ."c". else ."d".  69 420
//tokens = [{type: "if"}, {type: "."}, {type: "num", data: 1}, {type: "."}, {type: "."}, {type: "str", data: "a"}, {type: "."}, {type: "elif"}, {type: "."}, {type: "num", data: 2}, {type: "."}, {type: "."}, {type: "str", data: "b"}, {type: "."}, {type: "elif"}, {type: "."}, {type: "num", data: 3}, {type: "."}, {type: "."}, {type: "str", data: "c"}, {type: "."}, {type: "else"}, {type: "."}, {type: "str", data: "d"}, {type: "."}, {type: "num", data: 69}, {type: "num", data: 420}];

// for n .1..5. .print n.
//tokens = [{type: "for"}, {type: "name", data: "n"}, {type: "."}, {type: "num", data: 1}, {type: ".."}, {type: "num", data: 5}, {type: "."}, {type: "."}, {type: "name", data: "print"}, {type: "name", data: "n"}, {type: "."}];

// for ls x y .[[1 2] [3 4]]. .print x y.
//let tokens = [{type: "for"}, {type: "name", data: "ls"}, {type: "name", data: "x"}, {type: "name", data: "y"}, {type: "."}, {type: "["}, {type: "["}, {type: "num", data: 1}, {type: "num", data: 2}, {type: "]"}, {type: "["}, {type: "num", data: 3}, {type: "num", data: 4}, {type: "]"}, {type: "]"}, {type: "."}, {type: "."}, {type: "name", data: "print"}, {type: "name", data: "x"}, {type: "name", data: "y"}, {type: "."}];

//tokens = "+".split(".(..).").map(type => ({type}));

// !true & false, true | !false
//tokens = [{type: "!"}, {type: "name", data: "true"}, {type: "&"}, {type: "name", data: "false"}, {type: ","}, {type: "name", data: "true"}, {type: "|"}, {type: "!"}, {type: "name", data: "false"}];

// ~
//tokens = [{type: "~"}];

// 3 + ~
//tokens = [{type: "num"}, {type: "+"}, {type: "~"}];

//let tokens = "~~n+n*~n".split("").map(type => type != "n" ? {type} : {type: "num"});

//console.log(JSON.stringify(parse(tokens)));
//console.log(parse(tokens));

module.exports = parse;