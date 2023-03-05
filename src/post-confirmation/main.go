package main

import (
	"encoding/json"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
	"go.uber.org/zap"
)

type User struct {
	Name     string  `dynamodbav:"username" json:"username"`
	Email    string  `dynamodbav:"email" json:"email"`
	Verified bool    `dynamodbav:"email-verified" json:"email-verified"`
}

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
	user := User {
		Name: event.UserName,
		Email: event.Request.UserAttributes["email"],
		Verified: event.Request.UserAttributes["email_verified"] == "true",
	}

	// parse user into json and log
	jsonTxt, err := json.Marshal(user)
	if err != nil {
		logger.Error("Failed to parse User into json format",
			zap.Error(err),
		)
		return event, err
	}
	logger.Info("User signed up, migrate user into dynamodb",
		zap.String("user", string(jsonTxt)),
	)
	
	// marshal user in dynamodb
	result, err := dynamodbattribute.MarshalMap(user)
	if err != nil {
		logger.Error("Failed to parse User into json format",
			zap.Error(err),
		)
		return event, err
	}

	// put marshaled user into dynamodb
	putResult, err := dbService.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String("users"),
		Item: result,
	})
	if err != nil {
		logger.Error("Failed to migrate user into dynamodb",
			zap.Error(err),
		)
		return event, err
	}
	
	// parse put item output and log
	jsonTxt, err = json.Marshal(putResult.Attributes)
	if err != nil {
		logger.Error("Failed to parse dynamodb PutItemOutput into json",
			zap.Error(err),
		)
		return event, err
	}
	logger.Info("Successfully inserted user into dynamodb table[users]",
		zap.String("user inserted", string(jsonTxt)),
	)
	return event, nil
}

func main() {
	lambda.Start(handler)
}
