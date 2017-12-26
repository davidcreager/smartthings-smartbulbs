#!/bin/sh
echo "Test Starts"
CONTINUE=
gait --version
if [ $? -eq 0 ]; then
	echo git exists 
else
	echo git error $?
	CONTINUE="$CONTINUE , Git required"
fi
node -v
if [ $? -eq 0 ]; then
	echo Node exists
else
	echo Node error $?
		CONTINUE="$CONTINUE , Node required"
fi
echo "Test done - Continue=$CONTINUE"
if [ X"$CONTINUE" = X"" ]; then
	echo "Continuing"
else
	echo "Not Continuing $CONTINUE"
fi