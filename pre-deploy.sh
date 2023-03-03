for FILE in ./src/;
do echo $FILE;
go test -v ./$FILE
go build -o ./$FILE/main ./$FILE
zip ./$FILE.zip ./$FILE/main
done; 