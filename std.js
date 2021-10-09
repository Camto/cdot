"use strict";

let built_ins = {
	id(args) {
		return args;
	}
};

let ops = {
	"+"(expr) {
		if(expr.left.type == "num" && expr.right.type == "num")
			return {type: "num", data: expr.left.data + expr.right.data};
	}
};

module.exports = {built_ins, ops};