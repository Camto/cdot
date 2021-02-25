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

let ops = op_table.flat();

let is_op = token => ops.includes(token.type);

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
	let bound = [{ident: "sqrt", kind: "func"}, {ident: "map", kind: "func"}, {ident: "prod", kind: "func"}, {ident: "fact", kind: "func"}, {ident: "print", kind: "func"}];
	
	let find_bound_named = ident =>
		bound.find(var_or_func => var_or_func.ident == ident);
	
	function done(in_semiparens) {
		if(tokens.length == 0) return true;
		
		let first = tokens[0];
		return (
			[")", "]", "}", ","].includes(first.type) ||
			in_semiparens && first.type == ".");
	}
	
	function parse_rec(in_semiparens) {
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
				curr_section.push(parse_pipe_section(in_semiparens));
			}
		}
		pipe_sections.push(curr_section);
		
		return pipe_sections;
	}
	
	function parse_pipe_section(in_semiparens) {
		let first = tokens.shift();
		switch(first.type) {
			case ",": return "empty section";
			
			case "fn": return parse_fn(in_semiparens);
			case "=": throw "= before any var names";
			case "<-": throw "<- before any var names";
			
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
		let [var_op, vars] = parse_vars(in_semiparens);
		
		let func = "id";
		if(
				tokens.length > 0 &&
				tokens[0].type == "ident" &&
				find_bound_named(tokens[0].data).kind == "func")
			func = tokens.shift().data;
		
		let args = parse_args(in_semiparens);
		
		if(!var_op)
			return {kind: "call", func, args};
		else
			return {kind: var_op, vars, func, args};
	}
	
	function parse_vars(in_semiparens) {
		let var_op;
		let var_total;
		for(let i in tokens) {
			let token = tokens[i];
			if(["=", "<-"].includes(token.type)) {
				var_op = token.type;
				var_total = i;
				break;
			} else if(token.type != "ident") {
				break;
			}
		}
		
		let vars;
		if(var_op) {
			vars = tokens.splice(0, var_total);
			tokens.shift();
		}
		
		return [var_op, vars];
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
	
	function parse_chunk(in_semiparens) {
		let first = tokens.shift();
		
		switch(first.type) {
			case "number":
			case "string":
			case "?":
				return first;
			
			case "ident":
				return {
					kind: "call",
					func: first.data,
					arg: parse_args(in_semiparens)
				};
			
			case "$":
				if(tokens.length > 0) {
					return tokens.shift();
				} else {
					throw "$ with no token after";
				}
				
			case "(": {
				let is_func = tokens.length > 0 && tokens[0].type == ",";
				if(is_func)
					tokens.shift();
				
				let parse = parse_rec(false, "(");
				
				if(tokens.length > 0 && tokens[0].type == ")")
					tokens.shift();
				else
					throw "terminated ( with wrong thing";
				
				return {msg: "it parens", is_func, data: parse};
			}
			case "[": {
				let parse = parse_rec(false, "[");
				
				if(tokens.length > 0 && tokens[0].type == "]")
					tokens.shift();
				else
					throw "terminated [ with wrong thing";
				
				return {msg: "it list", data: parse};
			}
			case "{": {
				let parse = parse_rec(false, "{");
				
				if(tokens.length > 0 && tokens[0].type == "}")
					tokens.shift();
				else
					throw "terminated { with wrong thing";
				
				return {msg: "it dict", data: parse};
			}
			case ".": {
				if(in_semiparens) throw "how?";
				else {
					let is_func = tokens.length > 0 && tokens[0].type == ",";
					if(is_func)
						tokens.shift();
					
					let parse = parse_rec(true, ".");
					
					if(tokens.length > 0 && tokens[0].type == ".")
						tokens.shift();
					else
						throw "terminated . with wrong thing";
					
					return {msg: "it semi(", is_func, data: parse};
				}
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
				return {op: arg.type, left: "implicit", right: "implicit"};
		}
		
		i_of_highest = find_highest_prec_op(arg);
		while(i_of_highest != null) {
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
				{op: arg[i_of_highest].type, left: left_arg, right: right_arg}
			);
			
			i_of_highest = find_highest_prec_op(arg);
		}
		
		return arg[0];
	}
	
	return parse_rec(false);
}

// fact = .,1..?, prod., map $fact 1..10
//tokens = [{type: "ident", data: "fact"}, {type: "="}, {type: "."}, {type: ","}, {type: "number", data: 1}, {type: ".."}, {type: "?"}, {type: ","}, {type: "ident", data: "prod"}, {type: "."}, {type: ","}, {type: "ident", data: "map"}, {type: "$"}, {type: "ident", data: "fact"}, {type: "number", data: 1}, {type: ".."}, {type: "number", data: 10}];

// c q <- sqrt x^2 + y^2
//tokens = [{type: "ident", data: "c"}, {type: "ident", data: "q"}, {type: "<-"}, {type: "ident", data: "sqrt"}, {type: "number", data: "x"}, {type: "^"}, {type: "number", data: 2}, {type: "+"}, {type: "number", data: "y"}, {type: "^"}, {type: "number", data: 2}];

// 1+ +1
//tokens = [{type: "number"}, {type: "+"}, {type: "+"}, {type: "number"}];

// print sqrt 4
//tokens = [{type: "ident", data: "print"}, {type: "ident", data: "sqrt"}, {type: "number", data: 4}];

//tokens = "+".split(".(..).").map(type => ({type}));

console.log(JSON.stringify(parse_cdot(tokens)));