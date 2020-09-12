# c. , calc= but shorter

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

Should `x` be a specially parsed thing? Should variables be prefixed? If they're not prefixed, how are calls and variables distinguished?