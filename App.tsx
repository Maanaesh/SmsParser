import React, {useState, useEffect} from 'react';
import {
  Text,
  View,
  PermissionsAndroid,
  Alert,
  FlatList,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';

const App = () => {
  const [messages, setMessages] = useState<
    Array<{
      _id: string;
      address: string;
      body: string;
      type?: string;
      amount?: string;
    }>
  >([]);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [tags, setTags] = useState('');

  const requestSmsPermissionAndFetchMessages = async () => {
    try {
      const status = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
      );

      if (!status) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          {
            title: 'SMS Permission',
            message: 'We need access to your SMS to display messages.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Cannot access SMS messages.');
          return;
        }
      }

      fetchSmsInbox();
    } catch (err) {
      console.warn(err);
    }
  };

  const fetchSmsInbox = () => {
    const filter = {
      box: 'inbox',
    };

    SmsAndroid.list(
      JSON.stringify(filter),
      (fail: any) => {
        console.log('Failed with error: ' + fail);
      },
      (count: number, smsList: string) => {
        const messages = JSON.parse(smsList);

        // Regex for matching "credited" or "debited" and extracting the amount
        const regEx = /\b(credited|debited)\s+for\s+INR\s+([\d,.]+)/i;

        const filteredMessages = messages
          .map((msg: any) => {
            const match = msg.body.match(regEx);
            if (match) {
              return {
                _id: msg._id,
                address: msg.address,
                body: msg.body,
                type: match[1],
                amount: match[2], // Amount in INR
                processed: false, // Initially, mark the message as not processed
              };
            }
            return null;
          })
          .filter(Boolean); // Remove null entries

        setMessages(filteredMessages);
        console.log('Filtered Messages: ', filteredMessages);
      },
    );
  };

  const handleItemPress = (item: any) => {
    setSelectedMessage(item);
    setModalVisible(true);
  };

  const closeModal = async () => {
    try {
      if (selectedMessage) {
        // Send the selected message data to Google Sheets via API
        const response = await fetch(
          'https://script.google.com/macros/s/AKfycbyBUDEjBQvXm0ZCLJuF1T0fQdu_GQ4y5wx9zfHXm6P-oSXVPApQquV51DK3j7hDvP6trw/exec',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: selectedMessage.type.toUpperCase(),
              amount: selectedMessage.amount,
              date: new Date().toISOString(),
              tags : tags.toUpperCase(),
            }),
          },
        );

        const result = await response.json();

        if (result.status === 'success') {
          console.log(selectedMessage._id);
          SmsAndroid.delete(
            parseInt(selectedMessage['_id']),
            (fail: any) => {
              console.log(fail);
            },
            (success: any) => {
              console.log(success);
            },
          );
          setMessages(prevMessages =>
            prevMessages.filter(message => message._id !== selectedMessage._id),
          );
          setModalVisible(false);
          setSelectedMessage(null);
        } else {
          Alert.alert('Error', 'Failed to save the data to Google Sheets.');
        }
      }
    } catch (error) {
      console.error('Error saving data: ', error);
      Alert.alert('Error', 'Failed to save data.');
    }
  };

  useEffect(() => {
    requestSmsPermissionAndFetchMessages();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>SMS Reader</Text>
      <FlatList
        data={messages}
        keyExtractor={item => item._id}
        renderItem={({item}) => (
          <TouchableOpacity onPress={() => handleItemPress(item)}>
            <View style={styles.message}>
              <Text style={styles.address}>From: {item.address}</Text>
              <Text style={styles.body}>{item.body}</Text>
              {item.type && item.amount && (
                <Text style={styles.details}>
                  Transaction: {item.type} | Amount: INR {item.amount}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Modal for the form */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Transaction Details</Text>

            {/* Pre-filled form fields */}
            {selectedMessage && (
              <>
                <Text style={styles.modalLabel}>Type</Text>
                <TextInput
                  style={styles.input}
                  value={selectedMessage.type}
                  editable={false} // Make it read-only
                />

                <Text style={styles.modalLabel}>Amount</Text>
                <TextInput
                  style={styles.input}
                  value={selectedMessage.amount}
                  editable={false} // Make it read-only
                />
                <Text style={styles.modalLabel}>Tags</Text>
                <TextInput
                  style={styles.input}
                  value={tags}
                  onChangeText={setTags} // Update the state as the user types
                  placeholder="Enter tags"
                  editable={true}
                />
              </>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                closeModal();
              }}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  message: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  address: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  body: {
    fontSize: 14,
  },
  details: {
    fontSize: 14,
    color: '#007BFF',
    marginTop: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
  },
  closeButton: {
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});
