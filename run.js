"use strict";

let std = require("./std");

function run(pipeline, pipe_vals) {
	return pipeline.reduce(
		(pipe_vals, pipe_section) => run_pipe_section(pipe_section, pipe_vals),
		pipe_vals
	);
}

function run_pipe_section(pipe_section, pipe_vals) {
	switch(pipe_section.type) {
		case "call":
			let args = pipe_section.args.map(run_expr);
			
			if(pipe_section.i == 0)
				return std.built_ins[pipe_section.func](args);
			else
				throw "User functions uninplemented";
		default:
			throw "Pipe type unimplemented";
	}
}

function run_expr(expr) {
	switch(expr.type) {
		case "num":
			return expr;
		default:
			let op = std.ops[expr.type];
			if(expr.left)
				return op(run_expr(expr.left), run_expr(expr.right));
			else
				return op(run_expr(expr.arg));
	}
}

module.exports = run;