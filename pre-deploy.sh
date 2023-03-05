for f in ./src/*; do
  if [ -d "$f" ]; then
    echo Bundling: $f
    go build -o $f/main $f
    zip -j $f.zip $f/main
  fi
done;