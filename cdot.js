"use strict";

let lex = require("./lex");
let parse = require("./parse");

let tokens = lex(`
vm_ip = 0, vm_stack = [], vm_reg_a = 0, vm_reg_b = 0,

[PUSH POP ADD SUB R_INC R_DEC MUL DIV JMP JZ MOV R_PUSH] = 1..12,
REG_A REG_B = 0 1,

code = [PUSH 3 PUSH REG_A MOV PUSH REG_A R_INC PUSH REG_A R_PUSH],

fn get_byte (code @ vm_ip),
fn next_byte (vm_ip <- vm_ip + 1),
fn vm_pop (pop $vm_stack),
fn vm_push (push $vm_stack),

vm_do_instr = (
	instr = get_byte,
	if (instr == PUSH) (
		next_byte, vm_push get_byte
	) elif (instr == POP) (
		vm_pop, void
	) elif (instr == ADD) (
		x y = (vm_pop) (vm_pop),
		vm_push x + y
	) elif (instr == SUB) (
		x y = (vm_pop) (vm_pop),
		vm_push x - y
	) elif (instr == R_INC) (
		if (vm_pop)
			(vm_reg_b <- vm_reg_b + 1)
		else
			(vm_reg_a <- vm_reg_a + 1)
	) elif (instr == R_DEC) (
		if (vm_pop)
			(vm_reg_b <- vm_reg_b - 1)
		else
			(vm_reg_a <- vm_reg_a - 1)
	) elif (instr == MUL) (
		x y = (vm_pop) (vm_pop),
		vm_push x * y
	) elif (instr == DIV) (
		x y = (vm_pop) (vm_pop),
		vm_push x / y
	) elif (instr == JMP) (
		vm_ip <- (vm_pop) - 1
	) elif (instr == JZ) (
		if (!vm_reg_a)
			(vm_ip <- (vm_pop) - 1)
	) elif (instr == MOV) (
		x y = (vm_pop) (vm_pop),
		if (x)
			(vm_reg_b <- y)
		else
			(vm_reg_a <- y)
	) elif (instr == R_PUSH) (
		if (vm_pop)
			(vm_push vm_reg_b)
		else
			(vm_push vm_reg_a)
	)
	,
	
	next_byte
),

fn vm_exec (
	vm_do_instr,
	if (vm_ip < len code)
		(vm_exec)
),

vm_exec,

"\nVM State\n- Stack = " + vm_stack + "\n- Register A = " + vm_reg_a + "\n- Register B = " + vm_reg_b
`);
//console.log(tokens);
console.log(JSON.stringify(parse(tokens), null, "\t"));