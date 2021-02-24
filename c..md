# c. , calc= but shorter

Names can't have numbers, those would just be... numbers

Functions definition

```
fn fact ,1..q . prod,. map $fact 1..10
fn fact (1..? . prod); map \fact 1..10
```

`gsub` as a sort of method

```
fn disemvowel ,gsub '[AEIOUaeiou]' '',
fn disemvowel (gsub '[AEIOUaeiou]' '')

'vowels exist'.gsub '[AEIOUaeiou]' ''
'vowels exist'.disemvowel
'vowels exist' | gsub '[AEIOUaeiou]' ''
'vowels exist' | disemvowel
gsub '[AEIOUaeiou]' '' 'vowels exist'
disemvowel 'vowels exist'
```

Variables

```
x = 4
x is 4
1. x is id

list is ls 1 2 3. new_list is map p1 list. join ' ' new_list
list = [1 2 3]; new_list = map +1 list; join ' ' new_list
```

Multiple assignment

```
fn fib n (a b is 0 1. repeat n ,a b set b a p b,. a). map $fib 0..9
fn fib n (a b = 0 1; repeat n (a b <- b (a + b)); a); map \fib 0..9

fn fib n (0 1. repeat n ,store a b. b  a p b,. const); map \fib 0..9

fn fib n (
	0 1
	| repeat n (store a b; b (a + b))
	| store a _;
	a
);

map \fib 0..9
```

Currying

```
calc= 1 5 .. 1 $* fold
c. fold ,t, 1 1..5
c. fold (*) 1 1..5
```

Returning a function by name in a non obvious way

```
$fact. map q 1..10
ret fact. map q 1..10
tup fact. map q 1..10
```

Lambda

```
fact is ,.1..q . prod,. print map fact 1..10. print call fact 5
fact := {1..? | prod}; print map fact 1..10; print call fact 5
```

Complex example

```
fn map cb list (new is ls. for v list ,push \new call cb v,. new)

fn map callback list (
	letnew_list = [];
	for v list (
		push \new_list call callback v
	);
	new_list
)

map = (cb, ls) => {let new = []; for(let v of ls) new.push(cb(v)); return new}

function map(callback, list) {
	let new_list = []
	for(let v of list) {
		new_list.push(callback(v))
	}
	return new_list
}

def map(callback, list):
	new_list = []
	for v in list:
		new_list.append(callback(v))
	return new_list
```

Easter egg(s)

```
rps 'r'
eightball 'will i die tomorrow?'
```

## Don't go for depth

Names can't have numbers, those would just be... numbers

Functions definition

```
fn fact ,1..? . prod,. map fact 1..10
fn fact (1..? . prod). map fact 1..10
fn fact (1..? | prod); map fact 1..10
```

`gsub` as a sort of method

```
fn disemvowel ,gsub '[AEIOUaeiou]' '',
fn disemvowel (gsub '[AEIOUaeiou]' '')

'vowels exist'.gsub '[AEIOUaeiou]' ''
'vowels exist'.disemvowel
'vowels exist' | gsub '[AEIOUaeiou]' ''
'vowels exist' | disemvowel
gsub '[AEIOUaeiou]' '' 'vowels exist'
disemvowel 'vowels exist'
```

Variables

```
x = 4
x is 4
4. x is

list is ls 1 2 3. new_list is map p1 list. join ' ' new_list
list := [1 2 3]; new_list := map +1 list; join ' ' new_list
```

Multiple assignment

```
fn fib n ,a b is 0 1. repeat n (a b now b a p b). a,. map fib 0..9
fn fib n (a b = 0 1; repeat n (a b = b (a + b)); a); map fib 0..9
```

Currying

```
calc= 1 5 .. 1 $* fold
c. fold ,t, 1 1..5
c. fold (*) 1 1..5
```

Returning a function by name in a non obvious way

```
$fact. map 1..10
ret fact. map 1..10
tup fact. map 1..10
```

Lambda

```
fact is ,.1..? . prod,. print ,map fact 1..10,. print ,call fact 5,
fact := {1..? | prod}; print (map fact 1..10); print (call fact 5)
```

Easter egg(s)

```
rps 'r'
eightball 'will i die tomorrow?'
```

## Oldest

Kind of an experiment to see how typing friendly I can make it.

The comma pipes, there is no currying, it's just passed as the last argument
```
ls 1 2 3, map .p1.

range 1 10, filter .odd., sum
range 1 10, filter .odd., reduce .p. 0
```

Maybe swap em for iPhone convenience
```
range 1 10. filter ,odd,. sum
```

Function definition
```
def fact .from 1, prod., fact 5
```

Parens
```
def ,add (args ,x ,y. ,x p ,y). add 4 3
ls 1 2 3. map (p1)
```

All the same
```
3, from 1
from 1 3
range 1 3
```

Do strings gotta be quoted? What quotes?
```
print hello
print "hello"
print 'hello'
```
Will quote them, but with which?

Should `x` be a specially parsed thing? Should variables be prefixed? If they're not prefixed, how are calls and variables distinguished? If variables aren't prefixed, then `,` can be used for parenthesizing as originally intended.