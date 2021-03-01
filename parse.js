Array.prototype.map_maybe = function(fn) {
	return this.map(fn).filter(i => i != null);
}

let op_table = [
	["^"],
	["*", "/", "%", "%%"],
	["+", "-"],
	["==", "!=", "<", ">", "<=", ">=", ".."],
	["&", "|"]
];

let built_in_funcs = ["ls", "sqrt", "map", "prod", "print"];

let ops = op_table.flat();

let is_op = token => ops.includes(token.type) && !token.left;

let find_prec = op =>
	op_table.map_maybe((row, i) => row.includes(op.type) ? i : null);

let find_highest_prec_op = stuff =>
	stuff.reduce((highest, thing, i) => {
		if(is_op(thing) && find_prec(thing) < highest.prec)
			return {i, prec: find_prec(thing)};
		else
			return highest;
	}, {i: null, prec: op_table.length}).i;

function parse_cdot(tokens) {
	let bound = [built_in_funcs.map(name => ({kind: "func", name}))];
	// Have an error for redeclaring in the same scope
	// Have an error for <-ing a nonexistant var
	// Rn it does that set declares always, which it should never
	
	let find_bound_named = name =>
		bound.map_maybe((scope, i) => {
			let found = scope.find(var_or_func => var_or_func.name == name);
			if(found) return {kind: found.kind, i: bound.length - 1 - i};
			else return null;
		})[0] ||
		(() => {throw "not a name, bro"})();
	
	function done(in_semiparens, i = 0) {
		if(tokens.length <= i) return true;
		
		let first = tokens[i];
		return (
			[")", "]", "}", ","].includes(first.type) ||
			in_semiparens && first.type == ".");
	}
	
	function parse_rec(in_semiparens, new_scope = []) {
		bound.unshift(new_scope);
		
		let pipe_sections = [];
		let curr_section = [];
		
		while(
				!done(in_semiparens) ||
				tokens.length > 0 && tokens[0].type == ",") {
			
			if(tokens[0].type == ",") {
				tokens.shift();
				pipe_sections.push(curr_section);
				curr_section = [];
			} else {
				// fix things not related to multiple return getting extra boxed
				curr_section.push(parse_pipe_section(in_semiparens));
			}
		}
		pipe_sections.push(curr_section);
		
		bound.shift();
		
		return pipe_sections;
	}
	
	function parse_pipe_section(in_semiparens) {
		let first = tokens.shift();
		switch(first.type) {
			case "fn": return parse_fn(in_semiparens);
			
			case "store":
			case "args":
				return parse_store(in_semiparens);
			
			case "if": return parse_if(in_semiparens);
			case "for": return parse_for(in_semiparens);
			case "while": return parse_while(in_semiparens);
			case "repeat": return parse_repeat(in_semiparens);
			case "switch": return parse_switch(in_semiparens);
			
			default:
				tokens.unshift(first);
				return parse_normal(in_semiparens);
		}
	}
	
	function parse_normal(in_semiparens) {
		let {vars, declared, i} = lookahead_vars(in_semiparens);
		let var_op;
		if(
				vars &&
				i < tokens.length &&
				["=", "<-"].includes(tokens[i].type)) {
			var_op = tokens[i].type;
			tokens.splice(0, i + 1);
			if(var_op == "=") {
				bound[0] = declared.concat(bound[0]);
			} else if( var_op == "<-") {
				if(!declared.every(({name}) => find_bound_named(name).kind == "var"))
					throw "<-ing a func";
				vars = vars.map(index_vars);
			}
		}
		
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
		
		let args = parse_args(in_semiparens);
		
		if(!var_op)
			return {type: "call", func, i: scope_i, args};
		else
			return {type: var_op, vars, func, i: scope_i, args};
			
	}
	
	function parse_vars(in_semiparens) {
		let {vars, declared, i} = lookahead_vars(in_semiparens);
		tokens.splice(0, i);
		return {vars, declared};
	}
	
	function lookahead_vars(in_semiparens) {
		let vars = [];
		let declared = [];
		
		// Probably just use lookahead_var_list instead
		for(var i = 0; !done(in_semiparens, i); i++) {
			let token = tokens[i];
			if(token.type == "name") {
				if(token.data == "ls") {
					i++;
					let var_list;
					({var_list, i} = lookahead_var_list());
					vars.push({type: "list", data: var_list});
					i--;
				} else if(token.data == "dict") {
					i++;
					let var_dict;
					({var_dict, i} = lookahead_var_dict());
					vars.push({type: "dict", data: var_dict});
					i--;
				} else {
					vars.push({type: "var", data: token.data});
					declared.push({kind: "var", name: token.data});
				}
			} else if(token.type == "[") {
				i++;
				let var_list;
				({var_list, i} = lookahead_var_list());
				if(
						!var_list ||
						i >= tokens.length ||
						tokens[i].type != "]")
					break;
				vars.push({type: "list", data: var_list});
			} else if(token.type == "{") {
				i++;
				let var_dict;
				({var_dict, i} = lookahead_var_dict());
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
		
		function lookahead_var_list() {
			let vars = [];
			for(; !done(in_semiparens, i); i++) {
				let token = tokens[i];
				if(token.type == "name") {
					if(token.data == "ls") {
						i++;
						let var_list;
						({var_list, i} = lookahead_var_list());
						vars.push({type: "list", data: var_list});
						i--;
					} else if(token.data == "dict") {
						i++;
						let var_dict;
						({var_dict, i} = lookahead_var_dict());
						vars.push({type: "dict", data: var_dict});
						i--;
					} else {
						vars.push({type: "var", data: token.data});
						declared.push({kind: "var", name: token.data});
					}
				} else if(token.type == "[") {
					i++;
					let var_list;
					({var_list, i} = lookahead_var_list());
					if(
							!var_list ||
							i >= tokens.length ||
							tokens[i].type != "]")
						break;
					vars.push({type: "list", data: var_list});
				} else if(token.type == "{") {
					i++;
					let var_dict;
					({var_dict, i} = lookahead_var_dict());
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
			
			return {var_list: vars, i};
		}
		
		function lookahead_var_dict() {
			let vars = [];
			for(; !done(in_semiparens, i); i++) {
				let token = tokens[i];
				if(token.type == "name") {
					if(["ls", "dict"].includes(token.data == "ls")) {
						break;
					} else {
						vars.push({type: "var", data: token.data});
						declared.push({kind: "var", name: token.data});
					}
				} else {
					break;
				}
			}
			
			return {var_dict: vars, i};
		}
		
		return {vars, declared, i};
	}
	
	function parse_args(in_semiparens) {
		let args = [];
		while(!done(in_semiparens))
			args.push(parse_arg(in_semiparens));
		return args;
	}
	
	function parse_arg(in_semiparens) {
		first_chunk = parse_chunk(in_semiparens);
		let arg = first_chunk ? [first_chunk] : [];
		while(
				!done(in_semiparens) &&
				is_op(tokens[0])) {
			arg.push(tokens.shift());
			if(
					!done(in_semiparens) &&
					!is_op(tokens[0])) {
				arg.push(parse_chunk(in_semiparens));
			} else {
				break;
			}
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
			case "?":
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
						return {type: "func", name: token.data, i: bound_name.i};
				} else {
					throw "$ with no token after";
				}
				
			case "(": {
				let is_func = tokens.length > 0 && tokens[0].type == ",";
				if(is_func)
					tokens.shift();
				
				let parse = parse_rec(false);
				
				if(tokens.length > 0 && tokens[0].type == ")")
					tokens.shift();
				else
					throw "terminated ( with wrong thing";
				
				return {msg: "it parens", is_func, data: parse};
			}
			case "[": {
				let parse = parse_rec(false);
				
				if(tokens.length > 0 && tokens[0].type == "]")
					tokens.shift();
				else
					throw "terminated [ with wrong thing";
				
				return {msg: "it list", data: parse};
			}
			case "{": {
				let parse = parse_rec(false);
				
				if(tokens.length > 0 && tokens[0].type == "}")
					tokens.shift();
				else
					throw "terminated { with wrong thing";
				
				return {msg: "it dict", data: parse};
			}
			case ".": {
				if(in_semiparens) throw "how?";
				
				let is_func = tokens.length > 0 && tokens[0].type == ",";
				if(is_func)
					tokens.shift();
				
				let parse = parse_rec(true);
				
				if(tokens.length > 0 && tokens[0].type == ".")
					tokens.shift();
				else
					throw "terminated . with wrong thing";
				
				return {msg: "it semi(", is_func, data: parse};
			}
			case ")": throw "unexpected )";
			case "]": throw "unexpected ]";
			case "}": throw "unexpected }";
			
			default:
				tokens.unshift(first);
				return;
		}
	}
	
	function parse_ops(arg) {
		if(arg.length == 1) {
			if(!is_op(arg[0]))
				return arg[0];
			else
				return {type: arg.type, left: "implicit", right: "implicit"};
		}
		
		i_of_highest = find_highest_prec_op(arg);
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
		bound[0].unshift({kind: "func", name: name});
		
		let {vars, declared} = parse_vars(in_semiparens);
		if(
				done(in_semiparens) ||
				!["(", "."].includes(tokens[0].type))
			throw "no fn body bro";
		
		let open = tokens.shift().type;
		
		if(tokens.length > 0 && tokens[0].type == ",")
			throw "nuh uh fn ain't use no lambda";
		
		let body;
		if(open == "(") {
			body = parse_rec(false, declared);
			
			if(tokens.length > 0 && tokens[0].type == ")")
				tokens.shift();
			else
				throw "terminated ( with wrong thing";
		} else if(open == ".") {
			if(in_semiparens) throw "how?";
			
			body = parse_rec(true, declared);
			
			if(tokens.length > 0 && tokens[0].type == ".")
				tokens.shift();
			else
				throw "terminated . with wrong thing";
		} else {
			throw "how?";
		}
		
		return {type: "func", name, args: vars, body};
	}
	
	function parse_store(in_semiparens) {
		let {vars, declared} = parse_vars(in_semiparens);
		bound[0] = declared.concat(bound[0]);
		if(!done(in_semiparens))
			throw "more stuff after store/args?";
		
		return {type: "store", vars};
	}
			
	function parse_if(in_semiparens) {
		
	}
	
	function parse_for(in_semiparens) {
		
	}
	
	function parse_while(in_semiparens) {
		
	}
	
	function parse_repeat(in_semiparens) {
		
	}
	
	function parse_switch(in_semiparens) {
		
	}
	
	return parse_rec(false);
}

// fn fact .1..?, prod., map $fact 1..10
//tokens = [{type: "fn"}, {type: "name", data: "fact"}, {type: "."}, {type: "num", data: 1}, {type: ".."}, {type: "?"}, {type: ","}, {type: "name", data: "prod"}, {type: "."}, {type: ","}, {type: "name", data: "map"}, {type: "$"}, {type: "name", data: "fact"}, {type: "num", data: 1}, {type: ".."}, {type: "num", data: 10}];

// c q = sqrt 3^2 + 4^2
//tokens = [{type: "name", data: "c"}, {type: "name", data: "q"}, {type: "="}, {type: "name", data: "sqrt"}, {type: "num", data: "3"}, {type: "^"}, {type: "num", data: 2}, {type: "+"}, {type: "num", data: "4"}, {type: "^"}, {type: "num", data: 2}];

// 1+ +1
//tokens = [{type: "num"}, {type: "+"}, {type: "+"}, {type: "num"}];

// print sqrt 4
//tokens = [{type: "name", data: "print"}, {type: "name", data: "sqrt"}, {type: "num", data: 4}];

// .,args ls x y, x + y.
//tokens = [{type: "."}, {type: ","}, {type: "store"}, {type: "name", data: "ls"}, {type: "name", data: "x"}, {type: "name", data: "y"}, {type: ","}, {type: "name", data: "x"}, {type: "+"}, {type: "name", data: "y"}, {type: "."}];

// fn add [x y] .x + y., add ls 3 4
//tokens = [{type: "fn"}, {type: "name", data: "add"}, {type: "["}, {type: "name", data: "x"}, {type: "name", data: "y"}, {type: "]"}, {type: "."}, {type: "name", data: "x"}, {type: "+"}, {type: "name", data: "y"}, {type: "."}, {type: ","}, {type: "name", data: "add"}, {type: "name", data: "ls"}, {type: "num", data: "3"}, {type: "num", data: "4"}];

//tokens = [{type: ","}];

// a = 1, a <- 2
//tokens = [{type: "name", data: "a"}, {type: "="}, {type: "num", data: 1}, {type: ","}, {type: "name", data: "a"}, {type: "<-"}, {type: "num", data: 2}];

// ls a = ls 1, ls a <- ls 2
//tokens = [{type: "name", data: "ls"}, {type: "name", data: "a"}, {type: "="}, {type: "name", data: "ls"}, {type: "num", data: 1}, {type: ","}, {type: "name", data: "ls"}, {type: "name", data: "a"}, {type: "<-"}, {type: "name", data: "ls"}, {type: "num", data: 2}];

// fn a . ., a <- 1
tokens = [{type: "fn"}, {type: "name", data: "a"}, {type: "."}, {type: "."}, {type: ","}, {type: "name", data: "a"}, {type: "<-"}, {type: "num", data: 1}];

//tokens = "+".split(".(..).").map(type => ({type}));

console.log(JSON.stringify(parse_cdot(tokens)));
//console.log(parse_cdot(tokens));