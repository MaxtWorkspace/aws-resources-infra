package main

import (
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"go.uber.org/zap"
)

var logger *zap.Logger
var dbService *dynamodb.DynamoDB

func init() {
	logger, _ = zap.NewProduction()
	defer logger.Sync()

	sess := session.Must(session.NewSessionWithOptions(session.Options{
		SharedConfigState: session.SharedConfigEnable,
	}))
	dbService = dynamodb.New(sess)
}

func handler(event events.CognitoEventUserPoolsPostConfirmation) (events.CognitoEventUserPoolsPostConfirmation, error) {
	userName := event.UserName

	logger.Info("User signed in, mark user as online",
		zap.String("user name", userName),
	)

	return event, nil
}

func main() {
	lambda.Start(handler)
}
