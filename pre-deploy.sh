for f in ./src/*; do
  if [ -d "$f" ]; then
    echo $f;
    go test -v $f
    go build -o $f/main $f
    zip $f.zip $f/main
  fi
done;