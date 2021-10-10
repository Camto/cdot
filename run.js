"use strict";

let std = require("./std");

function run(pipeline, pipe_vals = [], qs = []) {
	return pipeline.reduce(
		(pipe_vals, pipe_section) => run_pipe_section(pipe_section, pipe_vals, qs),
		pipe_vals
	);
}

function run_pipe_section(pipe_section, pipe_vals, qs) {
	switch(pipe_section.type) {
		case "call":
			let args = pipe_section.args.map(expr => run_expr(
				expr,
				pipe_section.sets_qs
					? pipe_vals
					: qs
			));
			
			let func;
			if(pipe_section.i == 0)
				func = std.built_ins[pipe_section.func];
			else
				throw "User functions uninplemented";
			
			return func(
				pipe_section.sets_qs
					? args
					: args.concat(pipe_vals));
		default:
			throw "Pipe type unimplemented";
	}
}

function run_expr(expr, qs) {
	switch(expr.type) {
		case "expr":
			return run(expr.data, [], qs)[0]; // Add check
		case "num":
			return expr;
		case "?":
			return qs[expr.n - 1]; // Add check
		default:
			let op = std.ops[expr.type];
			if(expr.left)
				return op(run_expr(expr.left, qs), run_expr(expr.right, qs));
			else
				return op(run_expr(expr.arg, qs));
	}
}

module.exports = run;