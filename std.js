"use strict";

let built_ins = {
	id(args) {
		return args;
	}
};

let ops = {
	"+"(left, right) {
		if(left.type == "num" && right.type == "num")
			return {type: "num", data: left.data + right.data};
		else
			throw "+ only numbers rn";
	},
	
	"~"(arg) {
		if(arg.type == "num")
			return {type: "num", data: -arg.data};
		else
			throw "~ only numbers";
	},
	
	".."(left, right) {
		if(left.type == "num" && right.type == "num") {
			return {
				type: "list",
				data: left.data <= right.data
					? (
						Array(right.data - left.data + 1)
						.fill(0)
						.map((_, i) => ({type: "num", data: i + left.data})))
					: (
						Array(left.data - right.data + 1)
						.fill(0)
						.map((_, i) => ({type: "num", data: left.data - i})))
			};
		} else
			throw `.. only numbers rn not ${left.type} and ${right.type}`;
	}
};

module.exports = {built_ins, ops};