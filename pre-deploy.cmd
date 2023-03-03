SET GOOS=linux
SET GOARCH=amd64
FOR /D %%s IN (.\src\*) DO (
    echo %%s
    go test -v .\%%s
    go build -o .\%%s\main .\%%s
    powershell Compress-Archive -Path .\%%s\main -DestinationPath .\%%s.zip
)