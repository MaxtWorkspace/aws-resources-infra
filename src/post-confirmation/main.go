package main

import (
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
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
	//User name, email, email_verified should already be set by cognito
	userName := event.UserName
	email := event.Request.UserAttributes["email"]
	verified := event.Request.UserAttributes["email_verified"]

	logger.Info("User signed up, migrate user into dynamodb",
		zap.String("user name", userName),
		zap.String("email", email),
		zap.String("email verified", verified),
	)

	_, err := dbService.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String("Users"),
		Item: map[string]*dynamodb.AttributeValue{
			"username": {S: aws.String(userName)},
			"user_email": {
				M: map[string]*dynamodb.AttributeValue{
					"email":    {S: aws.String(email)},
					"verified": {BOOL: aws.Bool(verified == "true")},
				},
			},
		},
	})

	if err != nil {
		logger.Error("Failed to migrate user into dynamodb",
			zap.String("user name", userName),
			zap.String("email", email),
			zap.String("email verified", verified),
			zap.Error(err),
		)
		return event, err
	}

	return event, nil
}

func main() {
	lambda.Start(handler)
}
